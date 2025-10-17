document.getElementById("toggleWhitelist").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ type: "toggleWhitelist", url: tab.url }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    const list = response.whitelist || [];
    alert("Whitelist updated! Current list: " + list.join(", "));
  });
});

document.getElementById("showLogs").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "getLogs" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    const logs = response.logs || [];
    const container = document.getElementById("logContainer");
    container.innerHTML = "";
    logs.reverse().forEach(log => {
      const div = document.createElement("div");
      div.textContent = `[${log.timestamp}] ${log.domain} - ${log.action}`;
      container.appendChild(div);
    });
  });
});

document.getElementById("clearLogs").addEventListener("click", async () => {
  chrome.runtime.sendMessage({ type: "clearLogs" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    document.getElementById("logContainer").innerHTML = "";
  });
});
