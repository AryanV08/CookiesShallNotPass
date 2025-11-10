
// Import visualization module
import { visualization } from './visual.js';

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
  
  // Pre-initialize toggles to avoid timing mismatch in tests
  if (autoBlockToggle) autoBlockToggle.checked = false;
  if (blockerActiveToggle) blockerActiveToggle.checked = true;

  // Get references to DOM elements
  const allowedCookiesList = document.getElementById("allowedCookiesList");
  const blockedCookiesList = document.getElementById("blockedCookiesList");

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

  async function updateList(listName, transformFn) {
    const current = await fetchState();
    if (!current) return;
    const original = Array.isArray(current[listName]) ? current[listName] : [];
    const next = transformFn([...original]);
    if (!next) return;
    await updateState({ [listName]: next });
    updateListsUI({ ...current, [listName]: next });
  }

  async function addSiteToList(listName, site) {
    const normalized = (site || '').trim();
    if (!normalized) return;
    await updateList(listName, list => {
      if (list.includes(normalized)) return null;
      list.push(normalized);
      return list;
    });
  }

  async function removeSiteFromList(listName, site) {
    await updateList(listName, list => list.filter(entry => entry !== site));
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
      pill.setAttribute("aria-label", "Whitelisted sites: " + whitelistCount);
    }
  }
  if (blacklistCountEl) {
    blacklistCountEl.textContent = blacklistCount;
    const pill = blacklistCountEl.closest(".metric-pill");
    if (pill) {
      pill.setAttribute("aria-label", "Blacklisted sites: " + blacklistCount);
    }
  }

  // Update whitelist items
  whitelistEl.innerHTML = '';
  state.whitelist.forEach(site => {
    const li = document.createElement('li');
    li.textContent = site;
    const btn = document.createElement('button');
    btn.textContent = 'X'; // Remove button
    btn.onclick = () => removeSiteFromList('whitelist', site);
    li.appendChild(btn);
    whitelistEl.appendChild(li);
  });

  // Update blacklist items
  blacklistEl.innerHTML = '';
  state.blacklist.forEach(site => {
    const li = document.createElement('li');
    li.textContent = site;
    const btn = document.createElement('button');
    btn.textContent = 'X'; // Remove button
    btn.onclick = () => removeSiteFromList('blacklist', site);
    li.appendChild(btn);
    blacklistEl.appendChild(li);
  });
}

  // Update the entire UI 
  async function updateUI() {
  const state = await fetchState();
    if (state) {
      const blocked = state.blocked ?? 0;
      const allowed = state.allowed ?? 0;
      const banners = state.bannersRemoved ?? 0;
      
      //ensure counts and lists render immediatly 
      updateListsUI(state);
      
      // Update stats
      totalBlockedEl.textContent = blocked;
      totalAllowedEl.textContent = allowed;
      totalBannersEl.textContent = banners;
       const allowedCookies = state.allowedCookies || {};
      const blockedCookies = state.blockedCookies || {};

      if (allowedCookiesList) {
        allowedCookiesList.innerHTML = '';
        for (const [domain, cookies] of Object.entries(allowedCookies)) {
          const li = document.createElement('li');
          li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
          allowedCookiesList.appendChild(li);
        }
      }

      if (blockedCookiesList) {
        blockedCookiesList.innerHTML = '';
        for (const [domain, cookies] of Object.entries(blockedCookies)) {
          const li = document.createElement('li');
          li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
          blockedCookiesList.appendChild(li);
        }
      }
      // Update visualization
      visualization.updateChart(state);
      // Update allowed cookies list
      allowedCookiesList.innerHTML = '';
      for (const [domain, cookies] of Object.entries(state.allowedCookies)) {
        const li = document.createElement('li');
        li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
        allowedCookiesList.appendChild(li);
      }

      // Update blocked cookies list
      blockedCookiesList.innerHTML = '';
      for (const [domain, cookies] of Object.entries(state.blockedCookies)) {
        const li = document.createElement('li');
        li.textContent = `${domain}: ${JSON.stringify(cookies)}`;
        blockedCookiesList.appendChild(li);
      }
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
    const site = whitelistInput.value;
    whitelistInput.value = '';
    await addSiteToList('whitelist', site);
  };

  // Add site to blacklist
  addBlacklistBtn.onclick = async () => {
    const site = blacklistInput.value;
    blacklistInput.value = '';
    await addSiteToList('blacklist', site);
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
