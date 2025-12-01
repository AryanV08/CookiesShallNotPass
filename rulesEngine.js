// rulesEngine.js

// ---- Dynamic Rule ID seed ----
let nextRuleId = 1000; // dynamic starting ID

// ---- Load tracker domains from file (async, works in extension & Node test) ----
// This file is from a public tracker list (pgl.yoyo.org) and can be updated as needed.
let _trackerDomainsLoaded = false;
async function loadTrackerDomainsFromFile() {
  if (_trackerDomainsLoaded) return;

  // Helper to parse the file content into domain list
  const parse = (txt) => txt
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('*'))
    .slice(1); // Exclude the header line

  // 1) If running in a browser/extension context, fetch the packaged file using chrome.runtime.getURL
  try {
    if (typeof globalThis.chrome?.runtime?.getURL === 'function' && typeof fetch === 'function') {
      const url = chrome.runtime.getURL('tracker_domains.txt');
      const res = await fetch(url);
      if (res.ok) {
        const txt = await res.text();
        const fromFile = parse(txt);
        TRACKER_DOMAINS = Array.from(new Set(TRACKER_DOMAINS.concat(fromFile)));
        _trackerDomainsLoaded = true;
        return;
      }
    }
  } catch (e) {
    // ignore and try Node path below
  }

  // 2) If running under Node (tests), dynamically import node:fs and read the file
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // dynamic import to avoid bundlers pulling in node:fs for browser builds
      const fs = await import('node:fs');
      const txt = fs.readFileSync(new URL('./tracker_domains.txt', import.meta.url), 'utf-8');
      const fromFile = parse(txt);
      TRACKER_DOMAINS = Array.from(new Set(TRACKER_DOMAINS.concat(fromFile)));
      _trackerDomainsLoaded = true;
      return;
    }
  } catch (e) {
    // final fallback: leave TRACKER_DOMAINS as-is (hardcoded)
    console.warn('Failed to load tracker domains from file:', e);
  }

  _trackerDomainsLoaded = true;
}

// ---- Additional tracker domains to supplement the file ----
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
// Start with hardcoded list; additional domains from the packaged text file are loaded asynchronously
export let TRACKER_DOMAINS = Array.from(new Set(hardcodedTrackerDomains)); // Remove duplicates

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
  // Ensure external tracker list is loaded before building rules so tests and runtime see the same set
  await loadTrackerDomainsFromFile();
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
