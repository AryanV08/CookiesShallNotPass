import { Storage } from './storage.js';
import { createBlockRule, updateRules, ESSENTIAL_COOKIES } from './rulesEngine.js';

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

// Load state from storage
(async () => {
  await Storage.loadFromSync();
  const saved = await Storage.get("state");
  if (saved) state = saved;

  // Clear old rules
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });

  if (!state.autoBlock && state.blacklist.length > 0) {
    const rules = state.blacklist.map(d => createBlockRule(d));
    await updateRules(rules);
  }
})();

async function saveState() {
  await Storage.set("state", state);
}

// Check if cookie is essential
function isEssentialCookie(cookie) {
  if (ESSENTIAL_COOKIES.includes(cookie.name)) return true;
  if (cookie.httpOnly || cookie.secure) return true;
  if (!cookie.expirationDate) return true;
  return false;
}

// ----- Messages -----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch(msg.type) {
      case "GET_STATE":
        sendResponse({ success: true, state });
        break;

      case "GET_STATS":
        sendResponse({ success: true, stats: { blocked: state.blocked, allowed: state.allowed, bannersRemoved: state.bannersRemoved } });
        break;

      case "UPDATE_STATE":
        if (msg.state) state = { ...state, ...msg.state };
        await saveState();
        sendResponse({ success: true, state });
        break;

      case "BLOCK_SITE": {
        const domain = msg.domain;
        if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
        const idx = state.whitelist.indexOf(domain);
        if (idx !== -1) state.whitelist.splice(idx, 1);
        await updateRules(state.blacklist.map(d => createBlockRule(d)));
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "WHITELIST_SITE": {
        const domain = msg.domain;
        if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
        const idx = state.blacklist.indexOf(domain);
        if (idx !== -1) state.blacklist.splice(idx, 1);
        await updateRules(state.blacklist.map(d => createBlockRule(d)));
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

// ----- Cookie tracking -----
chrome.cookies.onChanged.addListener(change => {
  if (!state.active) return;

  const { removed, cookie } = change;
  const domain = cookie.domain.replace(/^\./, '');
  const inWhitelist = state.whitelist.includes(domain);

  if (isEssentialCookie(cookie)) return;

  if (state.autoBlock && !inWhitelist) {
    if (!removed) state.blocked++;
  } else if (!state.autoBlock && state.blacklist.includes(domain)) {
    if (!removed) state.blocked++;
  }

  saveState();
});

// Sync every 5 minutes
setInterval(() => Storage.syncToCloud(), 5*60*1000);

// Sync on suspend
chrome.runtime.onSuspend.addListener(() => {
  Storage.syncToCloud();
});
