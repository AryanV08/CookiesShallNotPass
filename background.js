
// background.js
import { Storage } from './storage.js';
import { updateRules, ESSENTIAL_COOKIES } from './rulesEngine.js';

console.log("[CSP] background loaded");

let state = {
  blocked: 0,
  allowed: 0,
  bannersRemoved: 0,
  blacklist: [],
  whitelist: [],
  active: true,
  autoBlock: true
};

// Set to track recently blocked cookies (use a timestamp for expiration)
const recentlyBlockedCookies = new Set();
const BLOCK_COOLDOWN_TIME = 10 * 1000; // 10 seconds cooldown for blocking the same cookie

// ---------------- Utils ----------------
function domainMatch(cookieDomain, targetDomain) {
  return cookieDomain === targetDomain || cookieDomain.endsWith('.' + targetDomain);
}

async function saveState() {
  await Storage.set("state", state);
}

// ---------------- Init ----------------
(async () => {
  await Storage.loadFromSync();
  const saved = await Storage.get("state");
  if (saved) state = saved;

  await updateRules();
})();

// ---------------- Messages ----------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch(msg.type) {
      case "GET_STATE":
        sendResponse({ success: true, state });
        break;

      case "UPDATE_STATE":
        if (msg.state) state = { ...state, ...msg.state };
        await saveState();
        sendResponse({ success: true, state });
        break;

      case "BLOCK_SITE": {
        const domain = msg.domain;
        if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
        state.whitelist = state.whitelist.filter(d => d !== domain);
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "WHITELIST_SITE": {
        const domain = msg.domain;
        if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
        state.blacklist = state.blacklist.filter(d => d !== domain);
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "LOG_BANNER_REMOVED":
        state.bannersRemoved += msg.count || 1;
        await saveState();
        sendResponse({ success: true, stats: state });
        break;

      default:
        sendResponse({ success: false });
    }
  })();
  return true;
});

// ---------------- Cookie Removal ----------------
chrome.cookies.onChanged.addListener(change => {
  if (!state.active || change.removed) return;

  const cookie = change.cookie;
  const domain = cookie.domain.replace(/^\./, '');
  const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

  // Ignore essential cookies or whitelisted domains
  if (inWhitelist || ESSENTIAL_COOKIES.includes(cookie.name)) return;

  // Only remove if autoBlock is enabled or domain is blacklisted
  if (state.autoBlock || state.blacklist.includes(domain)) {
    // Avoid blocking the same cookie within the cooldown period
    if (recentlyBlockedCookies.has(cookie.name + domain)) {
      console.log("[CSP] cookie already blocked recently:", cookie.name, domain);
      return; // Skip this blocking attempt
    }

    // Block the cookie
    chrome.cookies.remove({
      url: (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path,
      name: cookie.name
    }, (details) => {
      if (details && details.url) {
        state.blocked++;
        recentlyBlockedCookies.add(cookie.name + domain); // Add to the recently blocked set
        setTimeout(() => recentlyBlockedCookies.delete(cookie.name + domain), BLOCK_COOLDOWN_TIME); // Remove from set after cooldown
        saveState();
        
        // Log blocked cookie details to the console
        console.log("[CSP] Blocked cookie:", cookie.name, "Domain:", domain, "URL:", details.url);
      }
    });
  }
});



// ---------------- Cloud Sync ----------------
setInterval(() => Storage.syncToCloud(), 5 * 60 * 1000);
chrome.runtime.onSuspend.addListener(() => Storage.syncToCloud());
