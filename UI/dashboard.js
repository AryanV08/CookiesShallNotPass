// Run script after DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  // Get references to DOM elements
  const whitelistEl = document.getElementById("whitelist");
  const blacklistEl = document.getElementById("blacklist");
  const whitelistInput = document.getElementById("whitelistInput");
  const blacklistInput = document.getElementById("blacklistInput");
  const addWhitelistBtn = document.getElementById("addWhitelistBtn");
  const addBlacklistBtn = document.getElementById("addBlacklistBtn");

  const autoBlockToggle = document.getElementById("autoBlockToggle");
  const blockerActiveToggle = document.getElementById("blockerActiveToggle");

  const totalBlockedEl = document.getElementById("totalBlocked");
  const totalAllowedEl = document.getElementById("totalAllowed");
  const totalBannersEl = document.getElementById("totalBanners");

  const importFileEl = document.getElementById("importFile");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");

// Helpers to interact with background script
  async function fetchState() {
    // Ask background script for current state
    return new Promise(resolve => chrome.runtime.sendMessage({ type: "GET_STATE" }, res => resolve(res?.state)));
  }

  async function updateState(newState) {
    // Send updated state to background script
    return new Promise(resolve => chrome.runtime.sendMessage({ type: "UPDATE_STATE", state: newState }, res => resolve(res)));
  }

  // Update whitelist and blacklist UI
function updateListsUI(state) {
  const whitelistCountEl = document.getElementById("whitelistCount");
  const blacklistCountEl = document.getElementById("blacklistCount");

  const whitelistCount = state.whitelist.length;
  const blacklistCount = state.blacklist.length;

  if (whitelistCountEl) {
    whitelistCountEl.textContent = whitelistCount;
    const pill = whitelistCountEl.closest(".metric-pill");
    if (pill) {
      pill.setAttribute("aria-label", `Whitelisted sites: ${whitelistCount}`);
    }
  }
  if (blacklistCountEl) {
    blacklistCountEl.textContent = blacklistCount;
    const pill = blacklistCountEl.closest(".metric-pill");
    if (pill) {
      pill.setAttribute("aria-label", `Blacklisted sites: ${blacklistCount}`);
    }
  }

  // Update whitelist items
  whitelistEl.innerHTML = '';
  state.whitelist.forEach(site => {
    const li = document.createElement('li');
    li.textContent = site;
    const btn = document.createElement('button');
    btn.textContent = '❌'; // Remove button
    btn.onclick = async () => {
      state.whitelist = state.whitelist.filter(s => s !== site);
      await updateState(state);
      updateListsUI(state);
    };
    li.appendChild(btn);
    whitelistEl.appendChild(li);
  });

  // Update blacklist items
  blacklistEl.innerHTML = '';
  state.blacklist.forEach(site => {
    const li = document.createElement('li');
    li.textContent = site;
    const btn = document.createElement('button');
    btn.textContent = '❌'; // Remove button
    btn.onclick = async () => {
      state.blacklist = state.blacklist.filter(s => s !== site);
      await updateState(state);
      updateListsUI(state);
    };
    li.appendChild(btn);
    blacklistEl.appendChild(li);
  });
}

  // Update the entire UI 
  async function updateUI() {
  const state = await fetchState();
    if (state) {
      // Update stats
      totalBlockedEl.textContent = state.blocked ?? 0;
      totalAllowedEl.textContent = state.allowed ?? 0;
      totalBannersEl.textContent = state.bannersRemoved ?? 0;
    }
  
    if (state) {
      // Update toggles and lists
      autoBlockToggle.checked = state.autoBlock;
      blockerActiveToggle.checked = state.active;
      updateListsUI(state);
    }
  }

  // Event listeners for toggles and buttons
  autoBlockToggle.addEventListener("change", async () => {
    const state = await fetchState();
    if (!state) return;
    state.autoBlock = autoBlockToggle.checked;
    await updateState(state);
  });

  blockerActiveToggle.addEventListener("change", async () => {
    const state = await fetchState();
    if (!state) return;
    state.active = blockerActiveToggle.checked;
    await updateState(state);
  });

  // Add site to whitelist
  addWhitelistBtn.onclick = async () => {
    const site = whitelistInput.value.trim();
    if (!site) return;
    const state = await fetchState();
    if (!state.whitelist.includes(site)) state.whitelist.push(site);
    whitelistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  // Add site to blacklist
  addBlacklistBtn.onclick = async () => {
    const site = blacklistInput.value.trim();
    if (!site) return;
    const state = await fetchState();
    if (!state.blacklist.includes(site)) state.blacklist.push(site);
    blacklistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  // Import list from JSON file
  importBtn.onclick = async () => {
    const file = importFileEl.files[0];
    if (!file) return alert("Select a file first");
    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const state = await fetchState();
      state.whitelist = obj.whitelist || state.whitelist;
      state.blacklist = obj.blacklist || state.blacklist;
      await updateState(state);
      updateListsUI(state);
    } catch(e) { alert("Invalid file format"); }
  };

  // Export list to JSON file
  exportBtn.onclick = async () => {
    const state = await fetchState();
    const blob = new Blob([JSON.stringify({ whitelist: state.whitelist, blacklist: state.blacklist })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'csp_lists.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initial UI update on load
  await updateUI();
 
  // Periodic UI updates every 5 seconds (disabled during tests)
const IS_TEST = typeof window !== 'undefined' && window.__TEST__;
if (!IS_TEST) {
  setInterval(updateUI, 5000);
}
});
