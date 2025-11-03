let nextRuleId = 1000; // dynamic starting ID

// Essential cookies never blocked
export const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];

// List of known tracker domains to block (expand as needed)
export const TRACKER_DOMAINS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'facebook.com',
  'fbcdn.net',
  'scorecardresearch.com',
  'quantserve.com',
  'dotmetrics.net',
  'adservice.google.com'
];

export function createBlockRule(domain) {
  return {
    id: nextRuleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*://*.${domain}/*`,
      resourceTypes: [
        "main_frame", "sub_frame", "xmlhttprequest",
        "script", "image", "websocket"
      ]
    }
  };
}

export async function updateRules() {
  const rules = TRACKER_DOMAINS.map(d => createBlockRule(d));
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules
  });
}
