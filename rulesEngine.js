// rulesEngine.js

import fs from "node:fs";

// ---- Dynamic Rule ID seed ----
let nextRuleId = 1000; // dynamic starting ID

// ---- Cookie classification lists ----
const essentialKeywords = [
  'csrf', 'xsrf', 'session', 'auth', 'user_id', 'lang', 'theme', 'secure',
  'prefs', 'sessid', 'ssid', 'user', 'login', 'zipcode', 'country', 'currency', 'sid', 'uid', 'remember', 'verify'
];

const nonEssentialTrackingCookies = [
  '_ga', '_gid', '_fbp', '_gcl_au', '_ym_uid', '_gaexp', '_fbp', 'ga', 'track',
  'trk', 'ads', 'adid', 'adtrack', 'pixel', 'tag'
];

// ---- Load tracker domains from file ----
// This file is from a public tracker list (pgl.yoyo.org) and can be updated as needed.
const trackerDomainsFromFile = fs.readFileSync('./tracker_domains.txt', 'utf-8')
  .split('\n')
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('*')) // Exclude wildcards, we don't need these
  .slice(1); // Exclude the header line

// ---- Hardcoded tracker domains ----
const hardcodedTrackerDomains = [
  'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
  'fbcdn.net', 'scorecardresearch.com', 'quantserve.com', 'dotmetrics.net',
  'adservice.google.com', 'adroll.com', 'media.net', 'tapjoy.com',
  'criteo.com', 'addthis.com', 'piwik.pro', 'chartbeat.com', 'segment.com',
  'mixpanel.com', 'revcontent.com', 'taboola.com', 'quantcast.com', 'openx.net',
  'zergnet.com', 'bidswitch.net', 'bluekai.com', 'lotame.com', 'crwdcntrl.net',
  'getclicky.com', 'outbrain.com', 'advertising.com', 'braintreepayments.com',
  'moat.com', 'yandex.ru', 'flurry.com', 'seamlessdocs.com', 'pusher.com',
  't.co', 'vidyard.com', 'viglink.com', 'voicefive.com', 'voluumtrk.com',
  'w55c.net', 'walkme.com', 'webgains.com', 'webtrends.com', 'yieldify.com',
  'yieldlab.net', 'yieldmanager.com', 'yieldmanager.net'
  // (You can extend this list as needed)
];

// ---- Combined tracker domains ----
export const TRACKER_DOMAINS = Array.from(new Set(trackerDomainsFromFile.concat(hardcodedTrackerDomains))); // Remove duplicates

// ---- Cookie essential check ----
export function isEssential(cookie) {
  return new Promise((resolve) => {
    // 1) Obvious trackers by name -> non-essential
    const name = (cookie?.name || '').toLowerCase();
    const isTrackingCookie = nonEssentialTrackingCookies.some(trk => name.includes(trk));
    if (isTrackingCookie) return resolve(false);

    // 2) Keywords that typically indicate auth/session -> essential
    const isEssentialByName = essentialKeywords.some(kw => name.includes(kw));
    if (isEssentialByName) return resolve(true);

    // 3) If chrome.tabs is unavailable (e.g., unit tests), fall back to conservative logic
    if (!(globalThis.chrome?.tabs?.query)) {
      // Prefer secure, session-like, httpOnly/hostOnly as essential heuristics
      if (cookie?.secure && cookie?.hostOnly && cookie?.httpOnly) return resolve(true);
      if (cookie?.hostOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) return resolve(true);
      if (cookie?.httpOnly && cookie?.hostOnly) return resolve(true);
      if (!cookie?.expirationDate) return resolve(true); // session cookie
      return resolve(false);
    }

    // 4) Browser-context checks (cross-site etc.)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const currentTab = tabs?.[0];
      let isCrossSite = false;

      try {
        const currentOrigin = currentTab?.url ? new URL(currentTab.url).origin : '';
        // very rough domain-origin compare; if cookie.domain does not include origin host → treat as cross-site
        isCrossSite = !!(cookie?.domain && currentOrigin && !cookie.domain.includes(new URL(currentOrigin).hostname));
      } catch {
        // If URL parsing fails, don’t classify as cross-site solely on error
        isCrossSite = false;
      }

      if (isCrossSite) return resolve(false);

      if (cookie?.secure && cookie?.hostOnly && cookie?.httpOnly) return resolve(true);
      if (cookie?.hostOnly && (cookie?.sameSite === 'Strict' || cookie?.sameSite === 'Lax')) return resolve(true);
      if (cookie?.httpOnly && cookie?.hostOnly) return resolve(true);
      if (!cookie?.expirationDate) return resolve(true); // session cookie

      return resolve(false);
    });
  });
}

// ---- DNR rule factory ----
export function createBlockRule(domain) {
  return {
    id: nextRuleId++,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `*://*.${domain}/*`,
      resourceTypes: [
        'main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'image', 'websocket'
      ]
    }
  };
}

/**
 * Update Chrome DNR dynamic rules based on extension state.
 * Defaults to "active" when no state is provided, so tests can call updateRules()
 * without args and still get tracker rules installed.
 *
 * @param {{active?: boolean}=} state
 */
export async function updateRules(state = { active: true }) {
  const isActive = !!state?.active;

  // Build rules to add when active; otherwise, add none (effectively clears)
  const rulesToAdd = isActive ? TRACKER_DOMAINS.map(d => createBlockRule(d)) : [];

  // If the DNR API is not present (some unit envs), provide a no-op fallback
  const dnr = globalThis.chrome?.declarativeNetRequest;
  if (!dnr?.getDynamicRules || !dnr?.updateDynamicRules) {
    // Provide a soft fail path so tests won’t crash outside a mocked chrome
    // You can optionally throw here if you want tests to enforce a mock.
    return;
  }

  // Read current rules and remove them before adding new ones
  const existing = await dnr.getDynamicRules();
  const removeIds = existing.map(r => r.id);

  await dnr.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rulesToAdd
  });
}
