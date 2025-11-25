
// Import visualization module
import { visualization } from './visual.js';

export function parseJsonLists(text) {
  const obj = JSON.parse(text);
  return {
    whitelist: Array.isArray(obj.whitelist) ? obj.whitelist : [],
    blacklist: Array.isArray(obj.blacklist) ? obj.blacklist : []
  };
}

export function parseTxtLists(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const lists = { whitelist: [], blacklist: [] };
  let current = 'whitelist';
  lines.forEach(line => {
    const section = line.match(/^\[(whitelist|blacklist)\]$/i);
    if (section) {
      current = section[1].toLowerCase();
      return;
    }
    const inline = line.match(/^(whitelist|blacklist)\s*[:|-]\s*(.+)$/i);
    if (inline) {
      lists[inline[1].toLowerCase()].push(inline[2].trim());
      return;
    }
    lists[current].push(line);
  });
  return lists;
}

export function mergeLists(state, additions) {
  state.whitelist = Array.from(new Set([...(additions.whitelist || []), ...(state.whitelist || [])]));
  state.blacklist = Array.from(new Set([...(additions.blacklist || []), ...(state.blacklist || [])]));
  return state;
}

export function buildTxtExport(state = { whitelist: [], blacklist: [] }) {
  const buildSection = (title, entries = []) => {
    const header = `[${title}]`;
    const body = entries.length ? entries.join('\n') : '';
    return `${header}\n${body}`.trimEnd();
  };
  const safeState = {
    whitelist: Array.isArray(state.whitelist) ? state.whitelist : [],
    blacklist: Array.isArray(state.blacklist) ? state.blacklist : []
  };
  return `${buildSection('whitelist', safeState.whitelist)}\n\n${buildSection('blacklist', safeState.blacklist)}\n`;
}

export function buildJsonExport(state = { whitelist: [], blacklist: [] }) {
  const safeState = {
    whitelist: Array.isArray(state.whitelist) ? state.whitelist : [],
    blacklist: Array.isArray(state.blacklist) ? state.blacklist : []
  };
  return JSON.stringify(safeState, null, 2);
}

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
  const themeToggle = document.getElementById("themeToggle"); // NEW
  
  // Pre-initialize toggles to avoid timing mismatch in tests
  if (autoBlockToggle) autoBlockToggle.checked = false;
  if (blockerActiveToggle) blockerActiveToggle.checked = true;

  const totalBlockedEl = document.getElementById("totalBlocked");
  const totalAllowedEl = document.getElementById("totalAllowed");
  const totalBannersEl = document.getElementById("totalBanners");

  const importFileEl = document.getElementById("importFile");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const exportTxtBtn = document.getElementById("exportTxtBtn");

  

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

  // Build aggregate cookie counts per domain for charts
  function buildDomainCounts(allowedCookies = {}, blockedCookies = {}) {
    const domainMap = new Map();

    const appendCounts = (bucket, type) => {
      Object.entries(bucket || {}).forEach(([domain, cookies]) => {
        const count = Object.values(cookies || {}).reduce((sum, val) => sum + val, 0);
        if (!domainMap.has(domain)) domainMap.set(domain, { allowed: 0, blocked: 0 });
        domainMap.get(domain)[type] += count;
      });
    };

    appendCounts(allowedCookies, 'allowed');
    appendCounts(blockedCookies, 'blocked');

    return Array.from(domainMap.entries())
      .map(([domain, counts]) => ({ domain, ...counts, total: counts.allowed + counts.blocked }))
      .sort((a, b) => b.total - a.total);
  }

  // Aggregate cookie names across domains to find the noisiest offenders
  function buildAggressiveCookies(allowedCookies = {}, blockedCookies = {}, limit = 6) {
    const cookieMap = new Map();

    const appendCookies = (bucket, key) => {
      Object.values(bucket || {}).forEach(cookies => {
        Object.entries(cookies || {}).forEach(([name, count]) => {
          if (!cookieMap.has(name)) cookieMap.set(name, { name, blocked: 0, allowed: 0, total: 0 });
          const entry = cookieMap.get(name);
          entry[key] += count;
        });
      });
    };

    appendCookies(blockedCookies, 'blocked');
    appendCookies(allowedCookies, 'allowed');

    const aggressive = Array.from(cookieMap.values())
      .map(entry => ({ ...entry, total: entry.blocked + entry.allowed }))
      .filter(entry => entry.total > 0)
      .sort((a, b) => b.blocked - a.blocked || b.total - a.total || a.name.localeCompare(b.name));

    return aggressive.slice(0, limit);
  }

  // Render both pies in the cookies overview section
  function renderCookiePies(domains, allowedCookies, blockedCookies) {
    const themePiePalette = ['#1fc9a4', '#ff6b8c', '#8c6bff', '#33f3c1', '#ffb76b', '#ffda6b'];
    const topPalette = ['#8c6bff', '#33f3c1', '#ff6b8c', '#1fc9a4', '#ffb76b'];

    const aggressiveCookies = buildAggressiveCookies(allowedCookies, blockedCookies);
    const aggressiveData = aggressiveCookies.map((cookie, idx) => ({
      label: cookie.name,
      value: cookie.blocked || cookie.total, // prefer blocked signal, fall back to total
      color: themePiePalette[idx % themePiePalette.length],
      blocked: cookie.blocked,
      allowed: cookie.allowed,
      total: cookie.total
    }));

    renderPie('#cookiePieAggressive', aggressiveData, {
      legend: true,
      labelText: (_d, pct) => `${pct}%`,
      labelFill: '#f5f7ff',
      tooltipFormatter: (d, pct) => {
        const datum = d.data;
        return `<strong>${datum.label}</strong><br/>Share: ${pct}%<br/>Blocked: ${datum.blocked || 0}<br/>Allowed: ${datum.allowed || 0}<br/>Total: ${datum.total || datum.value}`;
      }
    });

    const topDomains = domains
      .filter(d => d.total > 0)
      .slice(0, 5)
      .map((d, idx) => ({ label: d.domain, value: d.total, color: topPalette[idx % topPalette.length] }));

    renderPie('#cookiePieTopDomains', topDomains, {
      legend: true,
      labelText: (_d, pct) => `${pct}%`,
      labelFill: '#f5f7ff',
      tooltipFormatter: (d, pct) => `<strong>${d.data.label}</strong><br/>Share: ${pct}%<br/>Total: ${d.data.value}`
    });
  }

  function getPieTooltip() {
    let el = document.querySelector('.pie-tooltip');
    if (!el) {
      el = document.createElement('div');
      el.className = 'pie-tooltip';
      document.body.appendChild(el);
    }
    return el;
  }

  function renderPie(selector, data, options = {}) {
    const container = document.querySelector(selector);
    if (!container) return;

    container.innerHTML = '';
    if (typeof d3 === 'undefined') {
      container.textContent = 'Charts unavailable.';
      return;
    }

    const nonZero = data.filter(item => item.value > 0);
    if (!nonZero.length) {
      container.textContent = 'No cookie activity yet.';
      return;
    }

    const width = container.clientWidth || 260;
    const height = 240;
    const radius = Math.min(width, height) / 2 - 10;

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie().value(d => d.value)(nonZero);
    const arc = d3.arc().innerRadius(40).outerRadius(radius);
    // Label arc retained for hover calculations; text rendering can be toggled off
    const labelArc = d3.arc().innerRadius(0).outerRadius(radius * 0.8);
    const total = nonZero.reduce((sum, d) => sum + d.value, 0) || 1;

    const tooltip = getPieTooltip();
    const paths = svg.selectAll('path')
      .data(pie)
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => d.data.color || '#8c6bff')
      .attr('stroke', '#0b0d1a')
      .attr('stroke-width', 2)
      .on('mouseover', (event, d) => {
        const pct = Math.round((d.data.value / total) * 100);
        const formatter = options.tooltipFormatter || ((datum, pctVal) => `<strong>${datum.data.label}</strong><br/>Share: ${pctVal}%<br/>Total: ${datum.data.value}`);
        tooltip.innerHTML = formatter(d, pct);
        tooltip.style.display = 'block';
      })
      .on('mousemove', event => {
        tooltip.style.left = `${event.clientX + 12}px`;
        tooltip.style.top = `${event.clientY + 12}px`;
      })
      .on('mouseout', () => {
        tooltip.style.display = 'none';
      });

    if (options.showLabels) {
      svg.selectAll('text')
        .data(pie)
        .enter()
        .append('text')
        .text(d => {
          const pct = Math.round((d.data.value / total) * 100);
          return options.labelText ? options.labelText(d, pct) : `${d.data.label}: ${pct}%`;
        })
        .attr('transform', d => `translate(${labelArc.centroid(d)})`)
        .attr('text-anchor', 'middle')
        .style('fill', options.labelFill || '#0b0d1a')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .style('stroke', '#0b0d1a')
        .style('stroke-width', '2px')
        .style('paint-order', 'stroke fill')
        .style('text-shadow', '0 1px 2px rgba(11,13,26,0.65)');
    }

    if (options.legend) {
      const legend = d3.select(container)
        .append('div')
        .style('margin-top', '8px');

      legend.selectAll('div')
        .data(nonZero)
        .enter()
        .append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '6px')
        .html(d => `<span style="display:inline-block;width:12px;height:12px;background:${d.color || '#8c6bff'}"></span><span>${d.label} (${d.value})</span>`);
    }
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

      const domainCounts = buildDomainCounts(allowedCookies, blockedCookies);

      // Update visualization
      visualization.updateChart(state);
      renderCookiePies(domainCounts, allowedCookies, blockedCookies);
    }
  
    if (state) {
      // Update toggles and lists
      autoBlockToggle.checked = state.autoBlock;
      blockerActiveToggle.checked = state.active;

      // NEW: theme handling (default to dark if missing)
      const theme = state.theme === "light" ? "light" : "dark";
      document.body.classList.toggle("light-theme", theme === "light");
      if (themeToggle) {
        // Checked = dark, unchecked = light
        themeToggle.checked = theme === "dark";
      }

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

  // NEW: theme toggle handler
  if (themeToggle) {
    themeToggle.addEventListener("change", async () => {
      const state = await fetchState();
      if (!state) return;

      const isDark = themeToggle.checked;
      state.theme = isDark ? "dark" : "light";
      await updateState(state);

      document.body.classList.toggle("light-theme", !isDark);
    });
  }

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

  function triggerDownload(content, fileName, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import list from JSON or TXT file
  importBtn.onclick = async () => {
    const file = importFileEl.files[0];
    if (!file) return alert("Select a file first");
    const filename = file.name;
    const text = await file.text();
    try {
      let lists;
      const lower = filename.toLowerCase();
      if (lower.endsWith('.json')) {
        lists = parseJsonLists(text);
      } else if (lower.endsWith('.txt')) {
        lists = parseTxtLists(text);
      } else {
        try {
          lists = parseJsonLists(text);
        } catch (jsonErr) {
          lists = parseTxtLists(text);
        }
      }

      const state = await fetchState();
      if (!state) throw new Error('Unable to load current lists');
      mergeLists(state, lists);
      await updateState(state);
      updateListsUI(state);
      importFileEl.value = '';
      alert(`Import successful: ${filename}`);
    } catch (e) {
      console.error('Import failed', e);
      alert("Invalid file format");
    }
  };

  // Export list to JSON file
  exportBtn.onclick = async () => {
    const state = (await fetchState()) || { whitelist: [], blacklist: [] };
    triggerDownload(buildJsonExport(state), 'csp_lists.json', 'application/json');
  };

  // Export list to TXT file
  if (exportTxtBtn) {
    exportTxtBtn.onclick = async () => {
      const state = (await fetchState()) || { whitelist: [], blacklist: [] };
      triggerDownload(buildTxtExport(state), 'csp_lists.txt', 'text/plain');
    };
  }

  // Initial UI update on load
  await updateUI();
 
  // Periodic UI updates every 5 seconds (disabled during tests)
const IS_TEST = typeof window !== 'undefined' && window.__TEST__;
if (!IS_TEST) {
  setInterval(updateUI, 5000);
}
});
