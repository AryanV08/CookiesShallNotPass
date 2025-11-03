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

  // Initialize DNR rules based on the blacklist
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
        await updateRules();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "WHITELIST_SITE": {
        const domain = msg.domain;
        if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
        state.blacklist = state.blacklist.filter(d => d !== domain);
        await saveState();
        await updateRules();
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

chrome.cookies.onChanged.addListener(change => {
  if (!state.active || change.removed) return;

  const cookie = change.cookie;
  const domain = cookie.domain.replace(/^\./, '');
  const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

  if (inWhitelist || ESSENTIAL_COOKIES.includes(cookie.name)) {
    console.log("[CSP] Cookie allowed via whitelist or essential:", cookie.name, "Domain:", domain);
    state.allowed++;
    saveState();  
    return;
  } 

  const cookieKey = `${domain}:${cookie.name}`;
  if (recentlyBlockedCookies.has(cookieKey)) {
    console.log("[CSP] Cookie already blocked recently, skipping:", cookieKey);
    return;
  }

  if (state.autoBlock || state.blacklist.includes(domain)) {
    console.log("[CSP] Cookie blocked via onChanged:", cookie.name, "Domain:", domain);

    // Directly increment the blocked count in the same background script
    state.blocked++;
    saveState(); // Make sure to save the state after the increment

    recentlyBlockedCookies.add(cookieKey);
    setTimeout(() => recentlyBlockedCookies.delete(cookieKey), BLOCK_COOLDOWN_TIME);
  }
});





// ---------------- Cloud Sync ----------------
setInterval(() => Storage.syncToCloud(), 5 * 60 * 1000);
chrome.runtime.onSuspend.addListener(() => Storage.syncToCloud());

