// A background script for the Extension that blocks non-essential cookies.

// Import necessary modules for storage and rules management
import { Storage } from './storage.js';
import { updateRules } from './rulesEngine.js';
import { isEssential } from './essentialCookies.js';

// Check if the script is running in a test environment
const IN_TEST =
  typeof globalThis !== 'undefined' &&
  !!globalThis.window &&
  !!globalThis.window.__TEST__;

// State object that persists across invocations
let state = {
  blocked: 0,  // Total number of cookies blocked for statistics
  allowed: 0,  // Total number of cookies allowed (essential or whitelisted)
  bannersRemoved: 0,  // Count of cookie banners suppressed
  blacklist: [],  // Domains where blocking is always enforced
  whitelist: [],  // Domains where blocking is always disabled
  active: true,  // Master switch for the blocker
  autoBlock: true,  // Whether to block cookies by default on unlisted sites
  autoBannerRemoval: true,  // Whether to auto-remove cookie banners
  savedBlockerState: null,  // Stores autoBlock/autoBannerRemoval when 'active' is toggled off
  aggresivietyLevel: 'standard',  // Feature for different blocking modes
  theme: 'dark',  // UI theme preference
  allowedCookies: {},  // Object to track allowed cookies by domain
  blockedCookies: {}  // Object to track blocked cookies by domain
};

// Track cookies being processed
const processingCookies = new Set();
// Cache essential cookie checks results to improve performance
const cookieCheckCache = new Map();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to check if a domain matches the target domain (handles subdomains)
function domainMatch(cookieDomain, targetDomain) {
  return cookieDomain === targetDomain || cookieDomain.endsWith('.' + targetDomain);
}

// Function to save the current state to storage
async function saveState() {
  await Storage.set('state', state);
}

// Generate all possible URL variations for a cookie
function generateCookieUrls(cookie, domain) {
  const urls = [];
  const protocols = ['https:', 'http:'];
  
  // Normalize domain
  const normalizedDomain = domain.startsWith('.') ? domain.substring(1) : domain;
  const dotDomain = domain.startsWith('.') ? domain : '.' + domain;
  
  const paths = [cookie.path || '/', '/'];
  
  for (const protocol of protocols) {
    for (const d of [normalizedDomain, dotDomain]) {
      for (const path of [...new Set(paths)]) {
        urls.push(`${protocol}//${d}${path}`);
      }
    }
  }
  
  return urls;
}

// Remove a cookie with multiple attempts using the generated URL variations
async function removeCookie(cookie, domain) {
  const cookieKey = `${domain}:${cookie.name}`;
  // Prevent concurrent removal attempts for the same cookie
  if (processingCookies.has(cookieKey)) {
    return false;
  }
  
  processingCookies.add(cookieKey);
  
  try {
    const urls = generateCookieUrls(cookie, domain);
    let removed = false;
    
    for (const url of urls) {
      // Attempt to remove the cookie using the Chrome API
      try {
        const details = await new Promise((resolve) => {
          chrome.cookies.remove({
            url: url,
            name: cookie.name,
            storeId: cookie.storeId
          }, resolve);
        });
        
        if (details) {
          console.log(`[CSP] ✓ Removed: ${cookie.name} from ${url}`);
          removed = true;
          break; // Stop after successful removal
        }
      } catch (error) {
        // Continue trying other URLs
      }
    }
    
    if (removed) {
      // Track blocked cookie
      if (!state.blockedCookies[domain]) {
        state.blockedCookies[domain] = {};
      }
      if (!state.blockedCookies[domain][cookie.name]) {
        state.blockedCookies[domain][cookie.name] = 0;
      }
      state.blockedCookies[domain][cookie.name]++;
      state.blocked++;
      // Persist updated stats
      await saveState();
    }
    
    return removed;
  } finally {
    setTimeout(() => processingCookies.delete(cookieKey), 1000);
  }
}


// Function to check if a cookie is essential (caches results for 5 minutes)
async function checkIfEssential(cookie, domain) {
  const cacheKey = `${domain}:${cookie.name}`;

  // Check if the result is in the cache
  if (cookieCheckCache.has(cacheKey)) {
    return cookieCheckCache.get(cacheKey);
  }

  // If not in cache, call isEssential and store the result
  const essential = await isEssential(cookie, state);
  if (cookieCheckCache.size >= MAX_CACHE_SIZE) {
    const firstKey = cookieCheckCache.keys().next().value;
    cookieCheckCache.delete(firstKey);
  }
  cookieCheckCache.set(cacheKey, essential);

  // Set a timeout to clear the cache after 5 minutes
  setTimeout(() => cookieCheckCache.delete(cacheKey), CACHE_TTL);

  return essential;
}

// Clean all existing non-essential cookies from the user's browser
async function cleanAllExistingCookies() {
  if (!state.active) return; // Skip if the blocker is globally inactive

  console.log("[CSP] Running cookie cleanup");

  try {
    // Fetch all cookies
    const allCookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });

    let cleanedCount = 0;

    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, '');

      // Check whitelist, essential status, and blocking rules
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) continue; // Skip whitelisted domains

      const isCookieEssential = await checkIfEssential(cookie, domain);
      if (isCookieEssential) continue; // Skip essential cookies

      if (state.autoBlock || state.blacklist.includes(domain)) {
        const removed = await removeCookie(cookie, domain);
        if (removed) cleanedCount++;
      }
    }

    console.log(`[CSP] Cleanup completed: removed ${cleanedCount} cookies`);
  } catch (error) {
    console.error("[CSP] Error during cookie cleanup:", error);
  }
}

// Continuous monitoring and removal
function startContinuousMonitoring() {
  if (!state.active) return;
  
  setInterval(async () => {
    if (!state.active) return;
    
    const allCookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });
    
    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, '');
      // Check against current rules
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) continue;
      
      const isCookieEssential = await checkIfEssential(cookie, domain);
      if (isCookieEssential) continue;
      
      if (state.autoBlock || state.blacklist.includes(domain)) {
        await removeCookie(cookie, domain);
      }
    }
  }, 120000); // Check every two minutes
}

// Initialize the background process
export async function initBackground(chromeAPI = chrome) {
  console.log('[CSP] background initialized');

  try {
    const synchronizedState = await Storage.mergeOrInitState();
    state = synchronizedState;
  } catch (err) {
      console.error("[CSP] Error during initial sync/merge:", err);
      // Fallback: If merge fails, load from local storage cache
      const saved = await Storage.get('state');
      if (saved) {
          state = saved;
      }
  }

  if (typeof updateRules === 'function') {
    await updateRules(state);
  }

  // Clean existing cookies
  setTimeout(() => {
    cleanAllExistingCookies();
  }, 1000);
  
  // Start continuous monitoring for JS-set cookies
  if (!IN_TEST) {
    startContinuousMonitoring();
  }

  // Listen for messages
  if (chromeAPI?.runtime?.onMessage?.addListener) {
    chromeAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      (async () => {
        switch (msg.type) {
          case 'GET_STATE':
            sendResponse({ success: true, state });
            break;

          case 'UPDATE_STATE':
              if (msg.state) {
                const oldState = { ...state };
                state = { ...state, ...msg.state };

                if(state.active !== oldState.active) {
                  updateRules(state).catch(err => {
                    console.error("[CSP] Error updating rules after state change:", err);
                  });
                }

                // Handle enable/disable logic
                if (state.active === false && oldState.active !== false) {
                  state.savedBlockerState = { autoBlock: state.autoBlock, autoBannerRemoval: state.autoBannerRemoval };
                  state.autoBlock = false;
                  state.autoBannerRemoval = false;
                }
                if (state.active && state.savedBlockerState) {
                  state.autoBlock = state.savedBlockerState.autoBlock;
                  state.autoBannerRemoval = state.savedBlockerState.autoBannerRemoval;
                  state.savedBlockerState = null;
                }

                await saveState(); // Save to local cache immediately

                // Trigger the 30-second debounced sync with the new state
                // Sync if whitelist/blacklist were explicitly changed in the update, or if active state changed.
                const whitelistChanged = JSON.stringify(oldState.whitelist) !== JSON.stringify(state.whitelist);
                const blacklistChanged = JSON.stringify(oldState.blacklist) !== JSON.stringify(state.blacklist);
                
                if (whitelistChanged || blacklistChanged || msg.state.active !== undefined) {
                    Storage.scheduleSync(state);
                }

                if (state.active && !oldState.active || state.aggresivietyLevel !== oldState.aggresivietyLevel) {
                  cookieCheckCache.clear();
                  setTimeout(() => cleanAllExistingCookies(), 500);
                }
              }
              sendResponse({ success: true, state });
              break;

          case 'BLOCK_SITE': {
            const domain = msg.domain;
            if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
            state.whitelist = state.whitelist.filter(d => d !== domain);
            await saveState(); // Local Cache Immediate
            // Trigger the 30-second debounced sync with the new state
            Storage.scheduleSync(state);
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'WHITELIST_SITE': {
            const domain = msg.domain;
            if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
            state.blacklist = state.blacklist.filter(d => d !== domain);
            await saveState(); // Local Cache Immediate
            // Trigger the 30-second debounced sync with the new state
            Storage.scheduleSync(state);
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
      return true;
    });
  }
  
  // Handle external changes (read from Sync and overwrite Local)
  if (chromeAPI?.storage?.onChanged?.addListener) {
    // Listen for changes to either the 'whitelist' or 'blacklist' keys
    chromeAPI.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && (changes.whitelist || changes.blacklist)) {
            console.log("[CSP] External Sync Change Detected. Overwriting local cache...");
            
            // Immediately overwrite local state with the new sync data
            Storage.overwriteLocalWithSync().then(syncedState => {
                // Update the in-memory state after successful overwrite
                if (syncedState) {
                    state = syncedState;
                }
            }).catch(error => {
                console.error("[CSP] Error during Sync-to-Local update:", error);
            });
        }
    });
  }

  // Listen for cookie changes (backup detection)
  if (chromeAPI?.cookies?.onChanged?.addListener) {
    chrome.cookies.onChanged.addListener(async change => {
      if (!state.active || change.removed) return;

      const cookie = change.cookie;
      const domain = cookie.domain.replace(/^\./, '');
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

      const isCookieEssential = await checkIfEssential(cookie, domain);
      if (inWhitelist || isCookieEssential) {
        state.allowed++;
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

      if (state.autoBlock || state.blacklist.includes(domain)) {
        // Immediate removal for JS-set cookies
        await removeCookie(cookie, domain);
      }
    });
  }

  // Sync on extension suspend (for immediate shutdown scenarios)
  if (!IN_TEST && chromeAPI?.runtime?.onSuspend?.addListener) {
    chromeAPI.runtime.onSuspend.addListener(() => {
      // Force immediate sync on shutdown (overwrite)
      try {
        Storage.forceSyncNow(state).catch(err => {
          console.error("[CSP] Error during suspend sync:", err);
        });
      } catch (err) {
        console.error("[CSP] Error calling forceSyncNow:", err);
      }
    });
  }
}

// Auto-init only outside tests
if (!IN_TEST) {
  console.log('[CSP] background loaded');
  initBackground().catch(err => {
    console.error('[CSP] init error', err);
    console.error('[CSP] Stack:', err?.stack);
  });
}