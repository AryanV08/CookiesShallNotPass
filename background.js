// Import necessary modules for storage and rules management
import { Storage, SYNC_INTERVAL } from './storage.js';
import { updateRules } from './rulesEngine.js';
import { isEssential } from './essentialCookies.js';

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
  autoBannerRemoval: true,
  aggresivietyLevel: 'standard',
  theme: 'dark',
  allowedCookies: {},
  blockedCookies: {}
};

// Track cookies being processed
const processingCookies = new Set();
const cookieCheckCache = new Map(); // Cache essential cookie checks

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

// Remove a cookie with multiple attempts
async function removeCookie(cookie, domain) {
  const cookieKey = `${domain}:${cookie.name}`;
  
  if (processingCookies.has(cookieKey)) {
    return false;
  }
  
  processingCookies.add(cookieKey);
  
  try {
    const urls = generateCookieUrls(cookie, domain);
    let removed = false;
    
    for (const url of urls) {
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
      await saveState();
    }
    
    return removed;
  } finally {
    setTimeout(() => processingCookies.delete(cookieKey), 1000);
  }
}

// Clean all existing non-essential cookies
async function cleanAllExistingCookies() {
  if (!state.active) return;
  
  console.log("[CSP] Running cookie cleanup");
  
  try {
    const allCookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });

    let cleanedCount = 0;
    
    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, '');
      
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) continue;
      
      const isCookieEssential = await isEssential(cookie, state);
      if (isCookieEssential) continue;
      
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

// CRITICAL: Use webRequest to block Set-Cookie headers BEFORE cookies are set
function setupCookieInterception(chromeAPI) {
  if (!chromeAPI?.webRequest?.onHeadersReceived?.addListener) {
    console.warn("[CSP] webRequest API not available - cookie blocking will be limited");
    return;
  }

  console.log("[CSP] Setting up cookie header interception");

  chromeAPI.webRequest.onHeadersReceived.addListener(
    async (details) => {
      if (!state.active) return {};
      
      const url = new URL(details.url);
      const domain = url.hostname.replace(/^www\./, '');
      
      // Check whitelist first
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) return {};
      
      // Check if should block this domain
      const shouldBlock = state.autoBlock || state.blacklist.includes(domain);
      if (!shouldBlock) return {};
      
      // Filter Set-Cookie headers
      const responseHeaders = details.responseHeaders || [];
      const filteredHeaders = [];
      let blockedCount = 0;
      
      for (const header of responseHeaders) {
        const headerName = header.name.toLowerCase();
        
        if (headerName === 'set-cookie') {
          // Parse cookie name from Set-Cookie header
          const cookieString = header.value || '';
          const cookieName = cookieString.split('=')[0].trim();
          
          // Create a mock cookie object for essential check
          const mockCookie = {
            name: cookieName,
            domain: domain,
            value: cookieString.split('=')[1]?.split(';')[0] || ''
          };
          
          // Check if essential (with caching)
          const cacheKey = `${domain}:${cookieName}`;
          let isEssentialCookie;
          
          if (cookieCheckCache.has(cacheKey)) {
            isEssentialCookie = cookieCheckCache.get(cacheKey);
          } else {
            isEssentialCookie = await isEssential(mockCookie, state);
            cookieCheckCache.set(cacheKey, isEssentialCookie);
            // Clear cache after 5 minutes
            setTimeout(() => cookieCheckCache.delete(cacheKey), 5 * 60 * 1000);
          }
          
          if (isEssentialCookie) {
            filteredHeaders.push(header);
            console.log(`[CSP] Allowed essential cookie header: ${cookieName} on ${domain}`);
          } else {
            blockedCount++;
            console.log(`[CSP] ✓ Blocked Set-Cookie header: ${cookieName} on ${domain}`);
            
            // Track blocked cookie
            if (!state.blockedCookies[domain]) {
              state.blockedCookies[domain] = {};
            }
            if (!state.blockedCookies[domain][cookieName]) {
              state.blockedCookies[domain][cookieName] = 0;
            }
            state.blockedCookies[domain][cookieName]++;
            state.blocked++;
          }
        } else {
          filteredHeaders.push(header);
        }
      }
      
      if (blockedCount > 0) {
        saveState(); // Don't await to avoid blocking
        return { responseHeaders: filteredHeaders };
      }
      
      return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking", "responseHeaders"]
  );
  
  console.log("[CSP] Cookie header interception active");
}

// Continuous monitoring and removal (backup for cookies set via JavaScript)
function startContinuousMonitoring() {
  if (!state.active) return;
  
  setInterval(async () => {
    if (!state.active) return;
    
    const allCookies = await new Promise(resolve => {
      chrome.cookies.getAll({}, resolve);
    });
    
    for (const cookie of allCookies) {
      const domain = cookie.domain.replace(/^\./, '');
      
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));
      if (inWhitelist) continue;
      
      const isCookieEssential = await isEssential(cookie, state);
      if (isCookieEssential) continue;
      
      if (state.autoBlock || state.blacklist.includes(domain)) {
        await removeCookie(cookie, domain);
      }
    }
  }, 2000); // Check every 2 seconds
}

// Initialize the background process
export async function initBackground(chromeAPI = chrome) {
  console.log('[CSP] background initialized');

  try {
    await Storage.loadFromSync();
  } catch (_) {}
  
  const saved = await Storage.get('state');
  if (saved) {
    state = saved;
    
    if (state.autoBannerRemoval === undefined) {
      state.autoBannerRemoval = true;
      await saveState();
    }
  }

  if (typeof updateRules === 'function') {
    await updateRules(state);
  }

  // CRITICAL: Set up cookie header interception FIRST
  setupCookieInterception(chromeAPI);

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
              
              if (state.active === false) {
                state.autoBannerRemoval = false;
                state.autoBlock = false;
                console.log("[CSP] Extension disabled");
              }
              
              await saveState();
              await updateRules(state);
              
              if (state.active && !oldState.active || state.aggresivietyLevel !== oldState.aggresivietyLevel) {
                setTimeout(() => cleanAllExistingCookies(), 500);
              }
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
            
          default:
            sendResponse({ success: false });
        }
      })();
      return true;
    });
  }

  // Listen for cookie changes (backup detection)
  if (chromeAPI?.cookies?.onChanged?.addListener) {
    chrome.cookies.onChanged.addListener(async change => {
      if (!state.active || change.removed) return;

      const cookie = change.cookie;
      const domain = cookie.domain.replace(/^\./, '');
      const inWhitelist = state.whitelist.some(d => domainMatch(domain, d));

      const isCookieEssential = await isEssential(cookie, state);
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

  // Sync state data to cloud
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
  initBackground().catch(err => {
    console.error('[CSP] init error', err);
    console.error('[CSP] Stack:', err?.stack);
  });
}