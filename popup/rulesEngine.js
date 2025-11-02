// rulesEngine.js
let nextRuleId = 1000;

// Essential cookies never blocked
export const ESSENTIAL_COOKIES = [
  "PHPSESSID",
  "JSESSIONID",
  "sessionid",
  "csrf_token",
  "auth_token",
  "SID",
  "HSID",
  "SSID",
  "SAPISID",
  "APISID",
  "LSID",
  "OSID",
  "NID",
  "AEC",
  "1P_JAR",
  "GAPS",
  "ACCOUNT_CHOOSER",
  "__Secure-1PAPISID",
  "__Secure-1PSID",
  "__Secure-1PSIDTS",
  "__Secure-3PAPISID",
  "__Secure-3PSID",
  "__Secure-3PSIDCC",
  "__Secure-ENID",
  "__Secure-SSID",
  "__Host-1PLSID",
  "__Host-1PSID",
  "__Host-GAPS",
  "__Host-3PLSID"
];

export function createBlockRule(domain) {
  return {
    id: nextRuleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `*://${domain}/*`,
      resourceTypes: ["xmlhttprequest", "script", "image"]
    }
  };
}

export async function updateRules(rules) {
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules
  });
}
