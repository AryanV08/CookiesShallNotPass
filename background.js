// background.js
import { Storage } from './storage.js';
import { updateRules, ESSENTIAL_COOKIES } from './rulesEngine.js';

const IN_TEST =
  typeof globalThis !== 'undefined' &&
  !!globalThis.window &&
  !!globalThis.window.__TEST__;

// Keep state module-scoped so it persists across invocations
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
const BLOCK_COOLDOWN_TIME = 10 * 1000; // 10 seconds cooldown

function domainMatch(cookieDomain, targetDomain) {
  return cookieDomain === targetDomain || cookieDomain.endsWith('.' + targetDomain);
}

async function saveState() {
  await Storage.set('state', state);
}

// Exported so tests (or future integration tests) can initialize explicitly
export async function initBackground(chromeAPI = chrome) {
  console.log('[CSP] background initialized');

  // ---- Init (load saved state + DNR rules) ----
  try {
    await Storage.loadFromSync();
  } catch (_) {}
  const saved = await Storage.get('state');
  if (saved) state = saved;

  if (typeof updateRules === 'function') {
    await updateRules();
  }

  // ---- Messages ----
  if (chromeAPI?.runtime?.onMessage?.addListener) {
    chromeAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      (async () => {
        switch (msg.type) {
          case 'GET_STATE':
            sendResponse({ success: true, state });
            break;

          case 'UPDATE_STATE':
            if (msg.state) state = { ...state, ...msg.state };
            await saveState();
            sendResponse({ success: true, state });
            break;

          case 'BLOCK_SITE': {
            const domain = msg.domain;
            if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
            state.whitelist = state.whitelist.filter(d => d !== domain);
            await saveState();
            await updateRules();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'WHITELIST_SITE': {
            const domain = msg.domain;
            if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
            state.blacklist = state.blacklist.filter(d => d !== domain);
            await saveState();
            await updateRules();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'LOG_BANNER_REMOVED':
            state.bannersRemoved += msg.count || 1;
            await saveState();
            sendResponse({ success: true, stats: state });
            break;

          default:
            sendResponse({ success: false });
        }
      })();
      return true; // async
    });
  }

  // ---- Cookies (guarded) ----
  if (chromeAPI?.cookies?.onChanged?.addListener) {
    chromeAPI.cookies.onChanged.addListener(change => {
      if (!state.active || change.removed) return;

      const cookie = change.cookie;
      const domain = cookie.domain.replace(/^\./, '');
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

      if (inWhitelist || ESSENTIAL_COOKIES.includes(cookie.name)) {
        // allowed path
        state.allowed++;
        saveState();
        return;
      }

      const cookieKey = `${domain}:${cookie.name}`;
      if (recentlyBlockedCookies.has(cookieKey)) return;

      if (state.autoBlock || state.blacklist.includes(domain)) {
        state.blocked++;
        saveState();
        recentlyBlockedCookies.add(cookieKey);
        setTimeout(() => recentlyBlockedCookies.delete(cookieKey), BLOCK_COOLDOWN_TIME);
      }
    });
  }

  // ---- Cloud sync (guard timers for tests) ----
  if (!IN_TEST) {
    setInterval(() => {
      Storage.syncToCloud().catch(() => {});
    }, 5 * 60 * 1000);

    if (chromeAPI?.runtime?.onSuspend?.addListener) {
      chromeAPI.runtime.onSuspend.addListener(() => Storage.syncToCloud());
    }
  }
}

// Auto-init only outside tests
if (!IN_TEST) {
  console.log('[CSP] background loaded');
  // fire-and-forget
  initBackground().catch(err => console.warn('[CSP] init error', err));
}