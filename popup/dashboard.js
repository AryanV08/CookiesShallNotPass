document.addEventListener("DOMContentLoaded", async () => {
  const whitelistEl = document.getElementById("whitelist");
  const blacklistEl = document.getElementById("blacklist");
  const whitelistInput = document.getElementById("whitelistInput");
  const blacklistInput = document.getElementById("blacklistInput");
  const addWhitelistBtn = document.getElementById("addWhitelistBtn");
  const addBlacklistBtn = document.getElementById("addBlacklistBtn");

  const whitelistCountEl = document.getElementById("whitelistCount");
  const blacklistCountEl = document.getElementById("blacklistCount");
  const whitelistPreviewEl = document.getElementById("whitelistPreview");
  const blacklistPreviewEl = document.getElementById("blacklistPreview");

  const autoBlockToggle = document.getElementById("autoBlockToggle");
  const blockerActiveToggle = document.getElementById("blockerActiveToggle");

  const totalBlockedEl = document.getElementById("totalBlocked");
  const totalAllowedEl = document.getElementById("totalAllowed");
  const totalBannersEl = document.getElementById("totalBanners");

  const importFileEl = document.getElementById("importFile");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");

  const bugSiteEl = document.getElementById("bugSite");
  const bugDescEl = document.getElementById("bugDesc");
  const reportBtn = document.getElementById("reportBtn");

  async function fetchState() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, res => resolve(res?.state));
    });
  }

  async function fetchStats() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "GET_STATS" }, res => resolve(res?.stats));
    });
  }

  async function updateState(newState) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: "UPDATE_STATE", state: newState }, res => resolve(res));
    });
  }

  function renderPreview(container, items = []) {
    if (!container) return;
    container.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('span');
      empty.className = 'empty-preview';
      empty.textContent = 'No entries yet';
      container.appendChild(empty);
      return;
    }

    const maxItems = 5;
    items.slice(0, maxItems).forEach(site => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = site;
      container.appendChild(chip);
    });

    if (items.length > maxItems) {
      const more = document.createElement('span');
      more.className = 'chip more';
      more.textContent = `+${items.length - maxItems} more`;
      container.appendChild(more);
    }
  }

  function updateListsUI(state) {
    const whitelistHeading = document.getElementById("whitelistHeading");
    const blacklistHeading = document.getElementById("blacklistHeading");

    const whitelist = Array.isArray(state?.whitelist) ? state.whitelist : [];
    const blacklist = Array.isArray(state?.blacklist) ? state.blacklist : [];

    if (whitelistHeading) whitelistHeading.textContent = `Whitelist (${whitelist.length})`;
    if (blacklistHeading) blacklistHeading.textContent = `Blacklist (${blacklist.length})`;
    if (whitelistCountEl) whitelistCountEl.textContent = whitelist.length;
    if (blacklistCountEl) blacklistCountEl.textContent = blacklist.length;

    renderPreview(whitelistPreviewEl, whitelist);
    renderPreview(blacklistPreviewEl, blacklist);

    whitelistEl.innerHTML = '';
    whitelist.forEach(site => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = site;
      const btn = document.createElement('button');
      btn.className = 'list-remove';
      btn.textContent = 'Remove';
      btn.onclick = async () => {
        state.whitelist = whitelist.filter(s => s !== site);
        await updateState(state);
        updateListsUI(state);
      };
      li.appendChild(label);
      li.appendChild(btn);
      whitelistEl.appendChild(li);
    });

    blacklistEl.innerHTML = '';
    blacklist.forEach(site => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = site;
      const btn = document.createElement('button');
      btn.className = 'list-remove';
      btn.textContent = 'Remove';
      btn.onclick = async () => {
        state.blacklist = blacklist.filter(s => s !== site);
        await updateState(state);
        updateListsUI(state);
      };
      li.appendChild(label);
      li.appendChild(btn);
      blacklistEl.appendChild(li);
    });
  }

  async function updateUI() {
    const stats = await fetchStats();
    if (stats) {
      totalBlockedEl.textContent = stats.blocked ?? 0;
      totalAllowedEl.textContent = stats.allowed ?? 0;
      totalBannersEl.textContent = stats.bannersRemoved ?? 0;
    }

    const state = await fetchState();
    if (state) {
      autoBlockToggle.checked = !!state.autoBlock;
      blockerActiveToggle.checked = !!state.active;
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
    state.whitelist = Array.isArray(state.whitelist) ? state.whitelist : [];
    if (!state.whitelist.includes(site)) state.whitelist.push(site);
    whitelistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  addBlacklistBtn.onclick = async () => {
    const site = blacklistInput.value.trim();
    if (!site) return;
    const state = await fetchState();
    state.blacklist = Array.isArray(state.blacklist) ? state.blacklist : [];
    if (!state.blacklist.includes(site)) state.blacklist.push(site);
    blacklistInput.value = '';
    await updateState(state);
    updateListsUI(state);
  };

  importBtn.onclick = async () => {
    const file = importFileEl.files?.[0];
    if (!file) return alert("Select a file first.");

    const text = await file.text();
    try {
      const obj = JSON.parse(text);
      const state = await fetchState();
      state.whitelist = Array.isArray(obj.whitelist) ? obj.whitelist : state.whitelist || [];
      state.blacklist = Array.isArray(obj.blacklist) ? obj.blacklist : state.blacklist || [];
      await updateState(state);
      updateListsUI(state);
      alert("Lists imported successfully.");
    } catch (err) {
      alert("Invalid file format. Provide a JSON export from this extension.");
    }
  };

  exportBtn.onclick = async () => {
    const state = await fetchState();
    const payload = JSON.stringify({ whitelist: state?.whitelist || [], blacklist: state?.blacklist || [] });
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cookies-shall-not-pass-lists.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  reportBtn.onclick = () => {
    const site = bugSiteEl.value.trim();
    const desc = bugDescEl.value.trim();
    if (!site || !desc) return alert("Fill both fields before submitting.");
    console.log("[CSP] Bug reported:", { site, desc });
    alert("Thank you! Your report has been captured.");
    bugSiteEl.value = '';
    bugDescEl.value = '';
  };

  await updateUI();
  setInterval(updateUI, 5000);
});
