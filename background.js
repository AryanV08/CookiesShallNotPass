// Import necessary modules for storage and rules management
import { Storage } from './storage.js';
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

  // Listen for messages from other parts of the extension
  if (chromeAPI?.runtime?.onMessage?.addListener) {
    chromeAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      (async () => {
                switch (msg.type) {
          case 'GET_STATE':
            // Respond with the current state
            sendResponse({ success: true, state });
            break;

          case 'UPDATE_STATE':
            // Update the state and save it
            if (msg.state) state = { ...state, ...msg.state };
            await saveState();
            await updateRules(state);
            sendResponse({ success: true, state });
            break;

          case 'BLOCK_SITE': {
            // Add a domain to the blacklist and remove it from the whitelist
            const domain = msg.domain;
            if (!state.blacklist.includes(domain)) state.blacklist.push(domain);
            state.whitelist = state.whitelist.filter(d => d !== domain);
            await saveState();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'WHITELIST_SITE': {
            // Add a domain to the whitelist and remove it from the blacklist
            const domain = msg.domain;
            if (!state.whitelist.includes(domain)) state.whitelist.push(domain);
            state.blacklist = state.blacklist.filter(d => d !== domain);
            await saveState();
            sendResponse({ success: true, stats: state });
            break;
          }

          case 'LOG_BANNER_REMOVED':
            // Increment the number of removed banners
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

  // Listen for changes in cookies (only triggered after cookies are set or modified)
  if (chromeAPI?.cookies?.onChanged?.addListener) {
    chrome.cookies.onChanged.addListener(async change => {
  // Ignore if the blocker is inactive or the cookie is removed
  if (!state.active || change.removed) return;

  const cookie = change.cookie;
  const domain = cookie.domain.replace(/^\./, '');  // Remove leading dot from the domain
  const inWhitelist = state.whitelist.some(d => domainMatch(domain, d)); // Check if domain is in the whitelist

  // Allow cookies from whitelisted domains or essential cookies
  const isCookieEssential = await isEssential(cookie);
  if (inWhitelist || isCookieEssential) {
    console.log("[CSP] Cookie allowed via whitelist or essential:", cookie.name, "Domain:", domain);
    state.allowed++;  // Increment allowed cookies counter

    // Track allowed cookies in the `allowedCookies` object
    if (!state.allowedCookies[domain]) {
      state.allowedCookies[domain] = {};
    }
    if (!state.allowedCookies[domain][cookie.name]) {
      state.allowedCookies[domain][cookie.name] = 0;
    }
    state.allowedCookies[domain][cookie.name]++;  // Increment the count of allowed cookies for this domain   
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
    // Track blocked cookies in the `blockedCookies` object
    if (!state.blockedCookies[domain]) {
      state.blockedCookies[domain] = {};
    }
    if (!state.blockedCookies[domain][cookie.name]) {
      state.blockedCookies[domain][cookie.name] = 0;
    }
    state.blockedCookies[domain][cookie.name]++;  // Increment the count of blocked cookies for this domain

    // Function to attempt cookie update on both HTTP and HTTPS
    const updateAndDeleteCookie = async (scheme) => {
        const cookieUrl = `${scheme}://${domain}${cookie.path || '/'}`; // Ensure the path is included
        const expiredDate = new Date(0); // Set expiration date to January 1, 1970

        try {
          // Get the cookie details
          const cookieDetails = await new Promise((resolve, reject) => {
            chrome.cookies.get({ url: cookieUrl, name: cookie.name }, (cookieDetails) => {
              if (cookieDetails) resolve(cookieDetails);
              else reject(new Error(`Failed to retrieve cookie ${cookie.name}`));
            });
          });

          // Clone the cookie and modify only the necessary fields
          console.log('Cookie details retrieved for updating:', cookieDetails);
          const { session, hostOnly, storeId, ...cookieForSet } = cookieDetails; // Remove properties not valid for cookies.set
          cookieForSet.url = cookieUrl;  // Ensure 'url' is included
          cookieForSet.value = "Intercepted by CSP";  // Update the value of the cookie
          cookieForSet.expirationDate = expiredDate.getTime() / 1000;  // Update expirationDate

          // Set the updated cookie
          chrome.cookies.set(cookieForSet, (setDetails) => {
            if (setDetails) {
              console.log(`Cookie ${cookie.name} updated with new value and expiration date.`);
            } else {
              console.log(`Failed to update cookie ${cookie.name}`);
            }
          });

          // After updating, delete the cookie (after a small delay to ensure the update happens)
          setTimeout(() => {
            chrome.cookies.remove({
              url: cookieUrl,
              name: cookie.name
            }, function (details) {
              if (details) {
                console.log(`Cookie deleted: ${cookie.name}, Domain: ${domain}, Path: ${cookie.path || '/'}`);
              } else {
                console.log(`Failed to delete cookie: ${cookie.name}, Domain: ${domain}, Path: ${cookie.path || '/'}`);
              }
            });
          }, 2000); // Wait for 500ms before deleting

        } catch (error) {
          console.error(error.message);
        }
      };

        // Try updating and deleting the cookie on HTTPS first
      await updateAndDeleteCookie("https");
      
      // If not updated and deleted via HTTPS, try HTTP
      if (!recentlyBlockedCookies.has(cookieKey)) {
        await updateAndDeleteCookie("http");
      }
        // Increment blocked cookies counter
        state.blocked++;
        await saveState();  // Save state after incrementing
        recentlyBlockedCookies.add(cookieKey);
        setTimeout(() => recentlyBlockedCookies.delete(cookieKey), BLOCK_COOLDOWN_TIME);  // Remove from recently blocked set after cooldown
      }
    });
  }

  // Sync state data to cloud if not in test mode
  if (!IN_TEST) {
    setInterval(() => {
      Storage.syncToCloud().catch(() => {});   // Attempt to sync every 5 minutes
    }, 5 * 60 * 1000);
    // Sync when the extension is suspended
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
