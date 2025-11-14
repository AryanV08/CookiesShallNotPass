// Import necessary modules for storage and rules management
import { Storage, SYNC_INTERVAL } from './storage.js';
import { updateRules, isEssential } from './rulesEngine.js';

// Check if the script is running in a test environment
const IN_TEST =
  typeof globalThis !== 'undefined' &&
  !!globalThis.window &&
  !!globalThis.window.__TEST__;

// State object that persists across invocations
let state = {
  blocked: 0,
  allowed: 0,
  bannersRemoved: 0,
  blacklist: [],
  whitelist: [],
  active: true,
  autoBlock: true,
  allowedCookies: {},
  blockedCookies: {}
};

// Set to track cookies that have been blocked recently (to prevent repeated blocking within a short time)
const recentlyBlockedCookies = new Set();
const BLOCK_COOLDOWN_TIME = 2 * 1000; // 2 seconds cooldown

// Function to check if a domain matches the target domain (handles subdomains)
function domainMatch(cookieDomain, targetDomain) {
  return cookieDomain === targetDomain || cookieDomain.endsWith('.' + targetDomain);
}

// Function to save the current state to storage
async function saveState() {
  await Storage.set('state', state);
}

// Remove a cookie permanently
async function removeCookie(cookie, domain) {
  const cookieKey = `${domain}:${cookie.name}`;
  
  // Skip if recently blocked
  if (recentlyBlockedCookies.has(cookieKey)) {
    return;
  }

  console.log("[CSP] Removing cookie:", cookie.name, "Domain:", domain);

  // Track in blocked cookies
  if (!state.blockedCookies[domain]) {
    state.blockedCookies[domain] = {};
  }
  if (!state.blockedCookies[domain][cookie.name]) {
    state.blockedCookies[domain][cookie.name] = 0;
  }
  state.blockedCookies[domain][cookie.name]++;
  state.blocked++;

  // Remove cookie from all possible URLs
  const protocols = ['https:', 'http:'];
  const basePaths = ['/', cookie.path || '/'];
  
  for (const protocol of protocols) {
    for (const path of basePaths) {
      const cookieUrl = `${protocol}//${domain}${path}`;
      
      try {
        await new Promise(resolve => {
          chrome.cookies.remove({
            url: cookieUrl,
            name: cookie.name,
            storeId: cookie.storeId
          }, (details) => {
            if (details) {
              console.log(`[CSP] Cookie deleted: ${cookie.name}, URL: ${cookieUrl}`);
            }
            resolve();
          });
        });
      } catch (error) {
        // Silent fail - cookie might not exist for this URL
      }
    }
  }

  // Add to recently blocked to prevent immediate recreation
  recentlyBlockedCookies.add(cookieKey);
  setTimeout(() => recentlyBlockedCookies.delete(cookieKey), BLOCK_COOLDOWN_TIME);
  
  await saveState();
}

// Clean all existing non-essential cookies once at startup
async function cleanAllExistingCookies() {
  if (!state.active) return;
  
  console.log("[CSP] Running one-time startup cookie cleanup");
  
  try {
    const allCookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });

    let cleanedCount = 0;
    
    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, '');
      
      // Check whitelist
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) continue;
      
      // Check if cookie is essential
      const isCookieEssential = await isEssential(cookie);
      if (isCookieEssential) continue;
      
      // Check blacklist or auto-block
      if (state.autoBlock || state.blacklist.includes(domain)) {
        await removeCookie(cookie, domain);
        cleanedCount++;
      }
    }
    
    console.log(`[CSP] Startup cleanup completed: removed ${cleanedCount} cookies. Total blocked: ${state.blocked}`);
    state.blocked += cleanedCount;
    await saveState();
    
  } catch (error) {
    console.error("[CSP] Error during startup cookie cleanup:", error);
  }
}

// Initialize the background process (loading state and rules)
export async function initBackground(chromeAPI = chrome) {
  console.log('[CSP] background initialized');

  try {
    // Attempt to load any synced storage data
    await Storage.loadFromSync();
  } catch (_) {}
  
  // Retrieve saved state and apply it
  const saved = await Storage.get('state');
  if (saved) state = saved;

  if (typeof updateRules === 'function') {
    await updateRules(state);
  }

  // Clean all existing cookies once at startup
  setTimeout(() => {
    cleanAllExistingCookies();
  }, 1000);

  // Listen for messages from other parts of the extension
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
            await updateRules(state);
            
            // If activating the blocker, clean existing cookies
            if (state.active) {
              setTimeout(() => cleanAllExistingCookies(), 500);
            }
            sendResponse({ success: true, state });
            break;

          case 'BLOCK_SITE': {
            const domain = msg.domain;
            if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
            state.whitelist = state.whitelist.filter(d => d !== domain);
            await saveState();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'WHITELIST_SITE': {
            const domain = msg.domain;
            if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
            state.blacklist = state.blacklist.filter(d => d !== domain);
            await saveState();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'LOG_BANNER_REMOVED':
            state.bannersRemoved += msg.count || 1;
            await saveState();
            sendResponse({ success: true, stats: state });
            break;

          case 'IS_ESSENTIAL':
            {
              const essential = await isEssential(msg.cookie);
              sendResponse({ essential });
            }
            break;

          default:
            sendResponse({ success: false });
        }
      })();
      return true;
    });
  }

  // Listen for changes in cookies
  if (chromeAPI?.cookies?.onChanged?.addListener) {
    chrome.cookies.onChanged.addListener(async change => {
      if (!state.active || change.removed) return;

      const cookie = change.cookie;
      const domain = cookie.domain.replace(/^\./, '');
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

      // Allow cookies from whitelisted domains or essential cookies
      const isCookieEssential = await isEssential(cookie);
      if (inWhitelist || isCookieEssential) {
        console.log("[CSP] Cookie allowed via whitelist or essential:", cookie.name, "Domain:", domain);
        state.allowed++;

        // Track allowed cookies
        if (!state.allowedCookies[domain]) {
          state.allowedCookies[domain] = {};
        }
        if (!state.allowedCookies[domain][cookie.name]) {
          state.allowedCookies[domain][cookie.name] = 0;
        }
        state.allowedCookies[domain][cookie.name]++;
        await saveState(); 
        return;
      }

      const cookieKey = `${domain}:${cookie.name}`;
      // Skip blocking if the cookie has already been blocked recently
      if (recentlyBlockedCookies.has(cookieKey)) {
        console.log("[CSP] Cookie already blocked recently, skipping:", cookieKey);
        return;
      }

      // Block the cookie if the domain is in the blacklist or auto-block is enabled
      if (state.autoBlock || state.blacklist.includes(domain)) {
        console.log("[CSP] Cookie blocked via onChanged:", cookie.name, "Domain:", domain);
        await removeCookie(cookie, domain);
      }
    });
  }

  // Sync state data to cloud if not in test mode
  if (!IN_TEST) {
    setInterval(() => {
      Storage.syncToCloud().catch(() => {});
    }, SYNC_INTERVAL);
    
    if (chromeAPI?.runtime?.onSuspend?.addListener) {
      chromeAPI.runtime.onSuspend.addListener(() => Storage.syncToCloud());
    }
  }
}

// Auto-init only outside tests
if (!IN_TEST) {
  console.log('[CSP] background loaded');
  initBackground().catch(err => console.warn('[CSP] init error', err));
}