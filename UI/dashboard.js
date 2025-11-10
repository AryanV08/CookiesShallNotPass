// Import visualization module
import { visualization } from './visual.js';

// Run script after DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  // Persistent state shared across handlers
  let state = await fetchState();

  // Get references to DOM elements
  const whitelistEl = document.getElementById("whitelist");
  const blacklistEl = document.getElementById("blacklist");
  const whitelistInput = document.getElementById("whitelistInput");
  const blacklistInput = document.getElementById("blacklistInput");
  const addWhitelistBtn = document.getElementById("addWhitelistBtn");
  const addBlacklistBtn = document.getElementById("addBlacklistBtn");

  const autoBlockToggle = document.getElementById("autoBlockToggle");
  const blockerActiveToggle = document.getElementById("blockerActiveToggle");

  // Pre-initialize toggles
  if (autoBlockToggle) autoBlockToggle.checked = state?.autoBlock ?? false;
  if (blockerActiveToggle) blockerActiveToggle.checked = state?.active ?? true;

  const allowedCookiesList = document.getElementById("allowedCookiesList");
  const blockedCookiesList = document.getElementById("blockedCookiesList");
  const totalBlockedEl = document.getElementById("totalBlocked");
  const totalAllowedEl = document.getElementById("totalAllowed");
  const totalBannersEl = document.getElementById("totalBanners");
  const importFileEl = document.getElementById("importFile");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");

  // Helpers
  async function fetchState() {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ type: "GET_STATE" }, res => resolve(res?.state))
    );
  }

  async function updateState(newState) {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ type: "UPDATE_STATE", state: newState }, res => resolve(res))
    );
  }

  // Update whitelist/blacklist UI
  function updateListsUI(state) {
    const whitelistCountEl = document.getElementById("whitelistCount");
    const blacklistCountEl = document.getElementById("blacklistCount");
    const whitelistCount = state.whitelist.length;
    const blacklistCount = state.blacklist.length;

    if (whitelistCountEl) whitelistCountEl.textContent = whitelistCount;
    if (blacklistCountEl) blacklistCountEl.textContent = blacklistCount;

    whitelistEl.innerHTML = '';
    state.whitelist.forEach(site => {
      const li = document.createElement('li');
      li.textContent = site;
      const btn = document.createElement('button');
      btn.textContent = '❌';
      btn.onclick = async () => {
        state.whitelist = state.whitelist.filter(s => s !== site);
        await updateState(state);
        updateListsUI(state);
      };
      li.appendChild(btn);
      whitelistEl.appendChild(li);
    });

    blacklistEl.innerHTML = '';
    state.blacklist.forEach(site => {
      const li = document.createElement('li');
      li.textContent = site;
      const btn = document.createElement('button');
      btn.textContent = '❌';
      btn.onclick = async () => {
        state.blacklist = state.blacklist.filter(s => s !== site);
        await updateState(state);
        updateListsUI(state);
      };
      li.appendChild(btn);
      blacklistEl.appendChild(li);
    });
  }

  // Update entire UI
  async function updateUI() {
    state = await fetchState(); // refresh shared state
    if (!state) return;

    totalBlockedEl.textContent = state.blocked ?? 0;
    totalAllowedEl.textContent = state.allowed ?? 0;
    totalBannersEl.textContent = state.bannersRemoved ?? 0;

    updateListsUI(state);
    visualization.updateChart(state);

    allowedCookiesList.innerHTML = '';
    for (const [domain, cookies] of Object.entries(state.allowedCookies || {})) {
      const li = document.createElement('li');
      li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
      allowedCookiesList.appendChild(li);
    }

    blockedCookiesList.innerHTML = '';
    for (const [domain, cookies] of Object.entries(state.blockedCookies || {})) {
      const li = document.createElement('li');
      li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
      blockedCookiesList.appendChild(li);
    }

    autoBlockToggle.checked = state.autoBlock;
    blockerActiveToggle.checked = state.active;
  }

  // Event listeners
  autoBlockToggle.addEventListener("change", async () => {
    if (!state) return;
    state.autoBlock = autoBlockToggle.checked;
    await updateState(state);
    autoBlockToggle.checked = state.autoBlock; // optimistic update
  });

  blockerActiveToggle.addEventListener("change", async () => {
    if (!state) return;
    state.active = blockerActiveToggle.checked;
    await updateState(state);
    blockerActiveToggle.checked = state.active;
  });

  addWhitelistBtn.onclick = async () => {
    const site = whitelistInput.value.trim();
    if (!site) return;
    if (!state.whitelist.includes(site)) state.whitelist.push(site);
    whitelistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  addBlacklistBtn.onclick = async () => {
    const site = blacklistInput.value.trim();
    if (!site) return;
    if (!state.blacklist.includes(site)) state.blacklist.push(site);
    blacklistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  importBtn.onclick = async () => {
    const file = importFileEl.files[0];
    if (!file) return alert("Select a file first");
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      state.whitelist = obj.whitelist || state.whitelist;
      state.blacklist = obj.blacklist || state.blacklist;
      await updateState(state);
      updateListsUI(state);
    } catch {
      alert("Invalid file format");
    }
  };

  exportBtn.onclick = async () => {
    const blob = new Blob([JSON.stringify({ whitelist: state.whitelist, blacklist: state.blacklist })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'csp_lists.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initial load
  await updateUI();

  // Periodic refresh
  const IS_TEST = typeof window !== 'undefined' && window.__TEST__;
  if (!IS_TEST) setInterval(updateUI, 5000);
});
