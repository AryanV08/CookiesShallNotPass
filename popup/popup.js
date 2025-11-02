document.addEventListener("DOMContentLoaded", async () => {
  const blockedCountEl = document.getElementById("blockedCount");
  const allowedCountEl = document.getElementById("allowedCount");
  const bannersRemovedEl = document.getElementById("bannersRemoved");
  const whitelistBtn = document.getElementById("whitelistBtn");
  const blockBtn = document.getElementById("blockBtn");
  const currentSiteEl = document.getElementById("currentSite");
  const activeToggle = document.getElementById("extensionToggle"); // popup toggle

  function sendMessage(msg) {
    return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = new URL(tab.url).hostname;
  currentSiteEl.textContent = domain;

  function updateUI(state) {
    blockedCountEl.textContent = state.blocked ?? 0;
    allowedCountEl.textContent = state.allowed ?? 0;
    bannersRemovedEl.textContent = state.bannersRemoved ?? 0;
    activeToggle.checked = state.active;
  }

  // --- Load initial state (includes stats) ---
  const res = await sendMessage({ type: "GET_STATE" });
  if (res?.success && res.state) {
    updateUI(res.state);
  }

  // --- Toggle active on change ---
  activeToggle.addEventListener("change", async () => {
    const res = await sendMessage({ type: "UPDATE_STATE", state: { active: activeToggle.checked } });
    if (res?.success) {
      // optional: refresh stats after update
      const updatedState = await sendMessage({ type: "GET_STATE" });
      if (updatedState?.success) updateUI(updatedState.state);
    }
  });

  // --- Block site button ---
  blockBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "BLOCK_SITE", domain });
    if (res?.success) {
      updateUI(res.stats);
      alert(`${domain} has been added to the blacklist.`);
    } else {
      alert(`Failed to block ${domain}.`);
    }
  });

  // --- Whitelist site button ---
  whitelistBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "WHITELIST_SITE", domain });
    if (res?.success) {
      updateUI(res.stats);
      alert(`${domain} has been added to the whitelist.`);
    } else {
      alert(`Failed to whitelist ${domain}.`);
    }
  });

  // --- Dashboard button ---
  const dashboardBtn = document.getElementById("dashboardBtn");
  dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup/dashboard.html") });
  });
});