const Logger = (() => {
  async function log(domain, action) {
    const logs = await getLogs();
    logs.push({
      domain,
      action,
      timestamp: new Date().toISOString()
    });
    await saveLogs(logs);
  }

  async function getLogs() {
    return new Promise(resolve => {
      chrome.storage.local.get({ logs: [] }, result => resolve(result.logs));
    });
  }

  async function clearLogs() {
    return new Promise(resolve => {
      chrome.storage.local.set({ logs: [] }, () => resolve());
    });
  }

  async function saveLogs(logs) {
    return new Promise(resolve => {
      chrome.storage.local.set({ logs }, () => resolve());
    });
  }

  return { log, getLogs, clearLogs };
})();
