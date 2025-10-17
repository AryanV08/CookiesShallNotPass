// Simple logger utility
const Logger = {
  async log(domain, action) {
    const result = await chrome.storage.local.get("logs");
    const logs = result.logs || [];
    logs.push({ timestamp: new Date().toISOString(), domain, action });
    await chrome.storage.local.set({ logs });
  },

  async getLogs() {
    const result = await chrome.storage.local.get("logs");
    return result.logs || [];
  },

  async clearLogs() {
    await chrome.storage.local.set({ logs: [] });
  }
};

// Helper to get storage items
async function getFromStorage(key) {
  const result = await chrome.storage.sync.get(key);
  return result[key] || [];
}

// Background message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const domain = msg.url ? new URL(msg.url).hostname : null;

    switch (msg.type) {
      case "toggleWhitelist":
        let whitelist = await getFromStorage("whitelist");
        if (domain) {
          if (whitelist.includes(domain)) {
            whitelist = whitelist.filter(d => d !== domain);
            await Logger.log(domain, "removed from whitelist");
          } else {
            whitelist.push(domain);
            await Logger.log(domain, "added to whitelist");
          }
          await chrome.storage.sync.set({ whitelist });
        }
        sendResponse({ whitelist });
        break;

      case "getLogs":
        const logs = await Logger.getLogs();
        sendResponse({ logs });
        break;

      case "clearLogs":
        await Logger.clearLogs();
        sendResponse({ status: "cleared" });
        break;

      default:
        console.warn("Unknown message:", msg);
        sendResponse({ status: "unknown" });
    }
  })();

  return true; // important for async sendResponse
});
