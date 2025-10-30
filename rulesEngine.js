// rulesEngine.js
let nextRuleId = 1000;

// Essential cookies never blocked
export const ESSENTIAL_COOKIES = ["PHPSESSID", "JSESSIONID", "sessionid", "csrf_token", "auth_token"];

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
