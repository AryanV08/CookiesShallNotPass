// Run after popup DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {

  // UI references for live stat counters + buttons
  const blockedCountEl = document.getElementById("blockedCount");
  const allowedCountEl = document.getElementById("allowedCount");
  const bannersRemovedEl = document.getElementById("bannersRemoved");
  const whitelistBtn = document.getElementById("whitelistBtn");
  const blockBtn = document.getElementById("blockBtn");
  const currentSiteEl = document.getElementById("currentSite");
  const activeToggle = document.getElementById("extensionToggle"); // main ON/OFF

  // helper: wraps chrome.runtime.sendMessage into a promise so we can await it
  function sendMessage(msg) {
    return new Promise(resolve => chrome.runtime.sendMessage(msg, res => resolve(res)));
  }

  // get the current active tab → used for block / whitelist operations
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const domain = new URL(tab.url).hostname;
  currentSiteEl.textContent = domain;

  // updates UI counters + toggle based on background state
  function updateUI(state) {
    blockedCountEl.textContent = state.blocked ?? 0;
    allowedCountEl.textContent = state.allowed ?? 0;
    bannersRemovedEl.textContent = state.bannersRemoved ?? 0;
    activeToggle.checked = state.active;
  }

  // Load initial extension state from background.js
  const res = await sendMessage({ type: "GET_STATE" });
  if (res?.success && res.state) {
    updateUI(res.state);
  }

  // toggle extension active/inactive when user flips switch
  activeToggle.addEventListener("change", async () => {
    const res = await sendMessage({ type: "UPDATE_STATE", state: { active: activeToggle.checked } });
    if (res?.success) {
      // re-read stats so popup stays consistent
      const updatedState = await sendMessage({ type: "GET_STATE" });
      if (updatedState?.success) updateUI(updatedState.state);
    }
  });

  // block = add current domain to blacklist
  blockBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "BLOCK_SITE", domain });
    if (res?.success) {
      updateUI(res.stats);
      alert(`${domain} has been added to the blacklist.`);
    } else {
      alert(`Failed to block ${domain}.`);
    }
  });

  // whitelist = add current domain to whitelist
  whitelistBtn.addEventListener("click", async () => {
    const res = await sendMessage({ type: "WHITELIST_SITE", domain });
    if (res?.success) {
      updateUI(res.stats);
      alert(`${domain} has been added to the whitelist.`);
    } else {
      alert(`Failed to whitelist ${domain}.`);
    }
  });

  // open full dashboard in a new tab
  const dashboardBtn = document.getElementById("dashboardBtn");
  dashboardBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("UI/dashboard.html") });
  });
});
