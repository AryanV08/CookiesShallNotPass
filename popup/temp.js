// popup.js
document.addEventListener("DOMContentLoaded", async () => {
  const blockedCountEl = document.getElementById("blockedCount");
  const allowedCountEl = document.getElementById("allowedCount");
  const bannersRemovedEl = document.getElementById("bannersRemoved");
  const whitelistBtn = document.getElementById("whitelistBtn");
  const blockBtn = document.getElementById("blockBtn");
  const currentSiteEl = document.getElementById("currentSite");

  // Helper to promisify sendMessage
  function sendMessage(msg) {
    return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
  }

  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url);
  const domain = url.hostname;
  currentSiteEl.textContent = domain;

  function updateUI(stats) {
    blockedCountEl.textContent = stats.blocked;
    allowedCountEl.textContent = stats.allowed;
    bannersRemovedEl.textContent = stats.bannersRemoved;
  }

  // Initial stats load
  const resStats = await sendMessage({ type: "GET_STATS" });
  updateUI(resStats.stats);

  // Block site button
  blockBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "BLOCK_SITE", domain });
    if (res?.success) updateUI(res.stats);
  });

  // Whitelist site button
  whitelistBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "WHITELIST_SITE", domain });
    if (res?.success) updateUI(res.stats);
  });
});

// background.js

import { Storage } from './storage.js';
import { createBlockRule, updateRules } from './rulesEngine.js';

console.log("Background service worker loaded");

// Default state
let state = {
  blocked: 0,
  allowed: 0,
  bannersRemoved: 0,
  blacklist: [],
  whitelist: []
};

// Load saved state
(async () => {
  const saved = await Storage.get("state");
  if (saved) state = saved;

  // Clean previous dynamic rules to avoid duplicates
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });

  // Re-apply blacklist rules
  const rules = state.blacklist.map(domain => createBlockRule(domain));
  if (rules.length > 0) await updateRules(rules);
})();

// Save state helper
async function saveState() {
  await Storage.set("state", state);
}

// Handle messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "GET_STATS":
        sendResponse({ stats: state });
        break;

      case "GET_STATUS":
        sendResponse({ active: state.active ?? true });
        break;

      case "TOGGLE_ACTIVE":
        state.active = msg.active;
        await saveState();
        sendResponse({ success: true });
        break;

      case "BLOCK_SITE": {
        const domain = msg.domain;

        // Remove from whitelist if present
        const wlIndex = state.whitelist.indexOf(domain);
        if (wlIndex !== -1) {
          state.whitelist.splice(wlIndex, 1);
          state.allowed = Math.max(0, state.allowed - 1);
        }

        // Only add to blacklist if not already there
        if (!state.blacklist.includes(domain)) {
          state.blacklist.push(domain);
          state.blocked++;
          const rule = createBlockRule(domain);
          await updateRules([rule]);
        }

        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "WHITELIST_SITE": {
        const domain = msg.domain;

        // Remove from blacklist if present
        const blIndex = state.blacklist.indexOf(domain);
        if (blIndex !== -1) {
          state.blacklist.splice(blIndex, 1);
          state.blocked = Math.max(0, state.blocked - 1);
          // Remove dynamic rule
          const rules = await chrome.declarativeNetRequest.getDynamicRules();
          const ruleToRemove = rules.find(r => r.condition.urlFilter.includes(domain));
          if (ruleToRemove) {
            await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleToRemove.id] });
          }
        }

        // Add to whitelist if not already there
        if (!state.whitelist.includes(domain)) {
          state.whitelist.push(domain);
          state.allowed++;
        }

        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      case "LOG_BANNER_REMOVED": {
        const count = msg.count || 1;
        state.bannersRemoved += count;
        await saveState();
        sendResponse({ success: true, stats: state });
        break;
      }

      default:
        sendResponse({ success: false });
    }
  })();

  return true; // Important! Keep message channel open for async response
});


// storage.js

// storage.js
export const Storage = {
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.get([key], (result) => resolve(result[key]));
    });
  },

  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ [key]: value }, () => resolve(true));
    });
  },

  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.sync.remove([key], () => resolve(true));
    });
  }
};


// content.js

// function removeCookieBanners() {
//   const banners = document.querySelectorAll(
//     '[id*="cookie"], [class*="cookie"], [class*="banner"], [id*="consent"]'
//   );
//   if (banners.length === 0) return; // don't log if nothing removed

//   banners.forEach(b => b.remove());

//   // Log removed banners
//   chrome.runtime.sendMessage({ type: "LOG_BANNER_REMOVED", count: banners.length });
// }


// (async function() {
//   const res = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
//   if (res.active) removeCookieBanners();
// })();

// chrome.runtime.onMessage.addListener((msg) => {
//   if (msg.type === "REMOVE_BANNERS") removeCookieBanners();
// });


// Helper to promisify sendMessage
function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => resolve(res));
  });
}

// Function to remove cookie banners
async function removeCookieBanners() {
  const banners = document.querySelectorAll(
    '[id*="cookie"], [class*="cookie"], [class*="banner"], [id*="consent"]'
  );
  if (banners.length === 0) return; // nothing to remove

  banners.forEach(b => b.remove());

  // Log removed banners
  await sendMessage({ type: "LOG_BANNER_REMOVED", count: banners.length });
}

// Run on page load if extension is active
(async function() {
  const res = await sendMessage({ type: "GET_STATUS" });
  if (res?.active) removeCookieBanners();
})();

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "REMOVE_BANNERS") removeCookieBanners();
});


// rulesEngine.js

// rulesEngine.js
let nextRuleId = 1000;

export function createBlockRule(domain) {
  return {
    id: nextRuleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*://${domain}/*`,
      resourceTypes: ["script", "xmlhttprequest", "image"]
    }
  };
}

export async function updateRules(rules) {
  // Remove all previous dynamic rules first
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules
  });
}
