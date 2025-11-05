document.addEventListener("DOMContentLoaded", async () => {
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
ß
  // const bugSiteEl = document.getElementById("bugSite");
  // const bugDescEl = document.getElementById("bugDesc");
  // const reportBtn = document.getElementById("reportBtn");

  async function fetchState() {
    return new Promise(resolve => chrome.runtime.sendMessage({ type: "GET_STATE" }, res => resolve(res?.state)));
  }

  async function updateState(newState) {
    return new Promise(resolve => chrome.runtime.sendMessage({ type: "UPDATE_STATE", state: newState }, res => resolve(res)));
  }

  function updateListsUI(state) {
  const whitelistHeading = document.getElementById("whitelistHeading");
  const blacklistHeading = document.getElementById("blacklistHeading");

  // Update headings with counts
  whitelistHeading.textContent = `Whitelist (${state.whitelist.length})`;
  blacklistHeading.textContent = `Blacklist (${state.blacklist.length})`;

  // Update whitelist items
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

  // Update blacklist items
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

  async function updateUI() {
  const state = await fetchState();
    if (state) {
      totalBlockedEl.textContent = state.blocked ?? 0;
      totalAllowedEl.textContent = state.allowed ?? 0;
      totalBannersEl.textContent = state.bannersRemoved ?? 0;
    }
  
    if (state) {
      autoBlockToggle.checked = state.autoBlock;
      blockerActiveToggle.checked = state.active;
      updateListsUI(state);
    }
  }

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

  addWhitelistBtn.onclick = async () => {
    const site = whitelistInput.value.trim();
    if (!site) return;
    const state = await fetchState();
    if (!state.whitelist.includes(site)) state.whitelist.push(site);
    whitelistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  addBlacklistBtn.onclick = async () => {
    const site = blacklistInput.value.trim();
    if (!site) return;
    const state = await fetchState();
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
      const state = await fetchState();
      state.whitelist = obj.whitelist || state.whitelist;
      state.blacklist = obj.blacklist || state.blacklist;
      await updateState(state);
      updateListsUI(state);
    } catch(e) { alert("Invalid file format"); }
  };

  exportBtn.onclick = async () => {
    const state = await fetchState();
    const blob = new Blob([JSON.stringify({ whitelist: state.whitelist, blacklist: state.blacklist })], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'csp_lists.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // reportBtn.onclick = () => {
  //   const site = bugSiteEl.value.trim();
  //   const desc = bugDescEl.value.trim();
  //   if (!site || !desc) return alert("Fill both fields");
  //   console.log("Bug reported:", { site, desc });
  //   alert("Thank you! Bug reported.");
  //   bugSiteEl.value = '';
  //   bugDescEl.value = '';
  // };

  await updateUI();
 
const IS_TEST = typeof window !== 'undefined' && window.__TEST__;
if (!IS_TEST) {
  setInterval(updateUI, 5000);
}
});