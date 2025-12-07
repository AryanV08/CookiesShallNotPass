// ===== Skip visualization entirely while testing =====
let visualization;

if (typeof window !== "undefined" && window.__TEST__) {
  visualization = { updateChart: () => {} };
} else {
  // ================= Helpers =================
  const MULTI_PART_TLDS = new Set([
    "co.uk",
    "org.uk",
    "gov.uk",
    "ac.uk",
    "co.jp",
    "com.au",
    "net.au",
    "org.au",
    "gov.au",
    "com.br",
    "com.cn",
    "com.hk",
    "com.sg",
    "co.in",
    "com.mx",
    "com.tr"
  ]);

  function formatCookieFrequencies(cookies) {
    if (!cookies || Object.keys(cookies).length === 0) {
      return "<small>No cookies recorded yet.</small>";
    }
    return Object.entries(cookies)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([name, count]) => `• ${name}: ${count} time${count > 1 ? "s" : ""}`)
      .join("<br/>");
  }

  function canonicalizeDomain(domain) {
    if (!domain || typeof domain !== "string") {
      return "unknown";
    }
    let normalized = domain.toLowerCase().trim();
    normalized = normalized.replace(/^https?:\/\//, "").replace(/\/$/, "");
    normalized = normalized.replace(/^www\./, "");
    normalized = normalized.replace(/^\.+|\.+$/g, "");

    const parts = normalized.split(".").filter(Boolean);
    if (parts.length <= 2) {
      return normalized || domain;
    }

    for (const suffix of MULTI_PART_TLDS) {
      if (normalized === suffix) continue;
      if (normalized.endsWith(`.${suffix}`)) {
        const suffixParts = suffix.split(".");
        if (parts.length > suffixParts.length) {
          return parts.slice(-(suffixParts.length + 1)).join(".");
        }
      }
    }

    return parts.slice(-2).join(".");
  }

  function mergeCookieMaps(target, source) {
    for (const [name, count] of Object.entries(source || {})) {
      target[name] = (target[name] || 0) + count;
    }
  }

  function computeDomainModel(state) {
    const map = new Map();
    const blockedMap = state.blockedCookies || {};
    const allowedMap = state.allowedCookies || {};

    const initEntry = domain => {
      const canonical = canonicalizeDomain(domain);
      if (!map.has(canonical)) {
        map.set(canonical, {
          domain: canonical,
          blocked: 0,
          allowed: 0,
          blockedCookies: {},
          allowedCookies: {},
          sourceDomains: new Set()
        });
      }
      const entry = map.get(canonical);
      entry.sourceDomains.add(domain);
      return entry;
    };

    for (const [domain, cookies] of Object.entries(blockedMap)) {
      const entry = initEntry(domain);
      mergeCookieMaps(entry.blockedCookies, cookies);
    }

    for (const [domain, cookies] of Object.entries(allowedMap)) {
      const entry = initEntry(domain);
      mergeCookieMaps(entry.allowedCookies, cookies);
    }

    return Array.from(map.values()).map(entry => {
      entry.blocked = Object.keys(entry.blockedCookies).length;
      entry.allowed = Object.keys(entry.allowedCookies).length;
      entry.total = entry.blocked + entry.allowed;
      entry.sourceDomains = Array.from(entry.sourceDomains).sort();
      return entry;
    });
  }

  function matchesQuery(domainObj, query) {
    if (!query) return true;
    const canonMatch = domainObj.domain.toLowerCase().includes(query);
    if (canonMatch) return true;
    if (Array.isArray(domainObj.sourceDomains)) {
      return domainObj.sourceDomains.some(domain =>
        domain.toLowerCase().includes(query)
      );
    }
    return false;
  }

  function applyFilterAndSort(model, state) {
    const q = (state.searchQuery || "").trim().toLowerCase();
    let data = q ? model.filter(d => matchesQuery(d, q)) : model.slice();

    switch (state.sortMode) {
      case "blocked":
        data.sort((a, b) => b.blocked - a.blocked || a.domain.localeCompare(b.domain));
        break;
      case "allowed":
        data.sort((a, b) => b.allowed - a.allowed || a.domain.localeCompare(b.domain));
        break;
      case "az":
        data.sort((a, b) => a.domain.localeCompare(b.domain));
        break;
      case "za":
        data.sort((a, b) => b.domain.localeCompare(a.domain));
        break;
      case "total":
      default:
        data.sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));
        break;
    }
    return data;
  }

  function resolveColor(...candidates) {
    for (const candidate of candidates) {
      if (candidate && typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
    return "#ffffff";
  }

  // ================= Tooltip (centered card, not following mouse) =================
  function createTooltip(container) {
    // Remove any existing tooltip
    container.selectAll(".custom-tooltip").remove();

    const styles = getComputedStyle(document.body);
    const bg = (styles.getPropertyValue("--panel") || "rgba(10, 12, 30, 0.98)").trim();
    const border = (styles.getPropertyValue("--panel-outline") || "rgba(140, 107, 255, 0.4)").trim();
    const textColor = (styles.getPropertyValue("--text") || "#f0f4ff").trim();

    const tooltip = container
      .append("div")
      .attr("class", "custom-tooltip")
      .style("position", "absolute")
      .style("top", "50%")
      .style("left", "50%")
      .style("transform", "translate(-50%, -50%)")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("padding", "16px 20px")
      .style("background", bg)
      .style("border", `1px solid ${border}`)
      .style("border-radius", "14px")
      .style("color", textColor)
      .style("font-size", "13px")
      .style("line-height", "1.55")
      .style("max-width", "360px")
      .style("box-shadow", "0 22px 55px rgba(0,0,0,0.75)")
      .style("backdrop-filter", "blur(18px)")
      .style("z-index", 1000);

    return {
      show(html /* event is ignored on purpose */) {
        tooltip.html(html).style("opacity", 1);
      },
      hide() {
        tooltip.style("opacity", 0);
      }
    };
  }

  function buildTooltipHtmlForDomain(domainObj) {
    const blockedFreq = formatCookieFrequencies(domainObj.blockedCookies);
    const allowedFreq = formatCookieFrequencies(domainObj.allowedCookies);

    const hasMultipleSources =
      Array.isArray(domainObj.sourceDomains) && domainObj.sourceDomains.length > 1;
    const listedSources = hasMultipleSources
      ? domainObj.sourceDomains.slice(0, 4).join(", ")
      : "";
    const remainingSources = hasMultipleSources
      ? Math.max(0, domainObj.sourceDomains.length - 4)
      : 0;

    return `
      <div style="margin-bottom:10px;">
        <div style="font-size:13px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7;">
          Cookies by Domain
        </div>
        <div style="font-size:17px; font-weight:600; margin-top:4px;">
          ${domainObj.domain}
        </div>
        ${
          hasMultipleSources
            ? `<div style="font-size:11px; opacity:0.75; margin-top:4px;">
                Includes: ${listedSources}${
                remainingSources > 0 ? ` +${remainingSources} more` : ""
              }
              </div>`
            : ""
        }
      </div>

      <div style="display:flex; gap:12px; margin-bottom:10px; font-size:13px;">
        <div style="padding:6px 10px; border-radius:999px; background:rgba(37,99,235,0.12);">
          <span style="opacity:0.8;">Total</span>
          <span style="font-weight:600; margin-left:6px;">${domainObj.total}</span>
        </div>
        <div style="padding:6px 10px; border-radius:999px; background:rgba(225,29,72,0.12);">
          <span style="opacity:0.8;">Blocked</span>
          <span style="font-weight:600; margin-left:6px;">${domainObj.blocked}</span>
        </div>
        <div style="padding:6px 10px; border-radius:999px; background:rgba(16,185,129,0.12);">
          <span style="opacity:0.8;">Allowed</span>
          <span style="font-weight:600; margin-left:6px;">${domainObj.allowed}</span>
        </div>
      </div>

      ${
        blockedFreq
          ? `
        <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.08); font-size:12px;">
          <div style="font-size:11px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.7; margin-bottom:4px;">
            Blocked cookies
          </div>
          ${blockedFreq}
        </div>`
          : ""
      }

      ${
        allowedFreq
          ? `
        <div style="margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.06); font-size:12px;">
          <div style="font-size:11px; letter-spacing:0.14em; text-transform:uppercase; opacity:0.7; margin-bottom:4px;">
            Allowed cookies
          </div>
          ${allowedFreq}
        </div>`
          : ""
      }
    `;
  }

  // ================= Domain Detail Panel =================
  function openDomainPanel(domainObj) {
    let panel = document.querySelector(".domain-slide-panel");
    if (!panel) {
      panel = document.createElement("div");
      panel.className = "domain-slide-panel";
      panel.innerHTML = `
        <div class="domain-slide-inner">
          <button class="domain-slide-close" aria-label="Close">×</button>
          <h3 class="domain-slide-title"></h3>
          <div class="domain-slide-body"></div>
        </div>
      `;
      document.body.appendChild(panel);
      panel
        .querySelector(".domain-slide-close")
        .addEventListener("click", () => panel.classList.remove("active"));
    }

    panel.querySelector(".domain-slide-title").textContent = domainObj.domain;
    const body = panel.querySelector(".domain-slide-body");

    const renderList = cookies => {
      if (!cookies || Object.keys(cookies).length === 0) {
        return `<p class="empty-preview">None recorded.</p>`;
      }
      return `
        <ul class="domain-cookie-list">
          ${Object.entries(cookies)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50)
            .map(
              ([name, count]) =>
                `<li><span>${name}</span><span>${count}</span></li>`
            )
            .join("")}
        </ul>`;
    };

    body.innerHTML = `
      <div class="domain-slide-section">
        <h4>Blocked cookies (${domainObj.blocked})</h4>
        ${renderList(domainObj.blockedCookies)}
      </div>
      <div class="domain-slide-section">
        <h4>Allowed cookies (${domainObj.allowed})</h4>
        ${renderList(domainObj.allowedCookies)}
      </div>
    `;

    requestAnimationFrame(() => panel.classList.add("active"));
  }

  // ================= Controls =================
  function createControls(container) {
    let host = container.querySelector(".viz-controls");
    if (!host) {
      host = document.createElement("div");
      host.className = "viz-controls";
      host.innerHTML = `
        <div class="viz-controls-left">
          <input type="text" class="viz-search" placeholder="Search domains…" aria-label="Search domains"/>
        </div>
        <div class="viz-controls-right">
          <span class="viz-sort-label">Sort by:</span>
          <button type="button" data-sort="total" class="viz-sort active">Trend</button>
          <button type="button" data-sort="blocked" class="viz-sort">Blocked</button>
          <button type="button" data-sort="allowed" class="viz-sort">Allowed</button>
          <button type="button" data-sort="az" class="viz-sort">A–Z</button>
        </div>
      `;
      container.prepend(host);
    }

    let sortHandler = () => {};
    let searchHandler = () => {};

    host.querySelectorAll(".viz-sort").forEach(btn => {
      btn.addEventListener("click", () => {
        host.querySelectorAll(".viz-sort").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        sortHandler(btn.dataset.sort);
      });
    });

    const searchInput = host.querySelector(".viz-search");
    searchInput.addEventListener("input", () => {
      searchHandler(searchInput.value.trim());
    });

    return {
      setSortHandler: fn => {
        sortHandler = fn;
      },
      setSearchHandler: fn => {
        searchHandler = fn;
      }
    };
  }

  // ================= Main Visualization =================
  let container, margin;

  function initializeVisualization() {
    container = document.querySelector(".visualization-container");
    if (!container) return { updateChart: () => {} };

    const chartRoot =
      document.querySelector("#chart") ||
      container.appendChild(document.createElement("div"));
    chartRoot.id = "chart";
    chartRoot.style.overflowX = "auto";
    chartRoot.style.overflowY = "hidden";
    chartRoot.style.position = "relative";

    const tooltip = createTooltip(d3.select(container));
    margin = { top: 50, right: 40, bottom: 130, left: 50 };

    let lastState = {
      blockedCookies: {},
      allowedCookies: {},
      sortMode: "total",
      searchQuery: ""
    };

    function updateChart(patch = {}) {
      lastState = { ...lastState, ...patch };
      const model = computeDomainModel(lastState);
      const data = applyFilterAndSort(model, lastState);
      const domainCount = data.length || 1;

      const minSpacePerDomain = 70;
      const containerWidth = container.clientWidth;
      const innerWidth = containerWidth - margin.left - margin.right;
      const requiredWidth = domainCount * minSpacePerDomain;
      const width = Math.max(innerWidth, requiredWidth);
      const height = 420;

      d3.select(chartRoot).select("svg").remove();
      const svg = d3
        .select(chartRoot)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      const styles = getComputedStyle(document.body);
      const bgFill =
        (styles.getPropertyValue("--chart-bg") || "rgba(10,15,35,0.6)").trim();
      const gridColor =
        (styles.getPropertyValue("--chart-grid") ||
          "rgba(255,255,255,0.06)").trim();
      const labelColor =
        (styles.getPropertyValue("--chart-muted") || "#a8b8ff").trim();
      const allowedBarColor = resolveColor(
        styles.getPropertyValue("--chart-allowed-bar"),
        styles.getPropertyValue("--chart-total-line"),
        "#22c55e"
      );
      const blockedBarColor = resolveColor(
        styles.getPropertyValue("--chart-blocked-bar"),
        styles.getPropertyValue("--chart-blocked-line"),
        "#ef4444"
      );
      const barOutlineColor = resolveColor(
        styles.getPropertyValue("--panel-outline"),
        "rgba(255,255,255,0.25)"
      );
      const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      // Background
      g.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", bgFill)
        .attr("rx", 16);

      if (!data.length) {
        g.append("text")
          .attr("x", innerWidth / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", labelColor)
          .style("font-size", "16px")
          .text("No cookie activity yet. Browse to see domains.");
        return;
      }

      const maxTotal = d3.max(data, d => d.total) || 1;
      const xIndex = d3
        .scaleLinear()
        .domain([0, domainCount - 1])
        .range([0, width]);
      const y = d3
        .scaleLinear()
        .domain([0, maxTotal * 1.15])
        .nice()
        .range([height, 0]);

      // Expose for debugging if needed
      window.currentXScale = xIndex;
      window.currentYScale = y;

      // Grid behind the bars
      const gridGroup = g.append("g").attr("class", "grid-lines");
      gridGroup
        .selectAll("line")
        .data(y.ticks(6))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", gridColor)
        .attr("stroke-width", 0.8)
        .attr("stroke-dasharray", "4 6");

      const barWidth = Math.max(26, Math.min(90, width / domainCount * 0.55));

      const barsGroup = g
        .append("g")
        .attr("class", "bars")
        .style("mix-blend-mode", "normal");

      const domainGroups = barsGroup
        .selectAll(".domain-bar")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "domain-bar")
        .attr("transform", (d, i) => `translate(${xIndex(i) - barWidth / 2},0)`);

      barsGroup.raise();

      domainGroups
        .append("rect")
        .attr("class", "allowed-segment")
        .attr("x", 0)
        .attr("width", barWidth)
        .attr("y", d => y(d.allowed))
        .attr("height", d => Math.max(0, height - y(d.allowed)))
        .attr("fill", allowedBarColor)
        .attr("opacity", 0.95)
        .attr("stroke", "none");

      domainGroups
        .append("rect")
        .attr("class", "blocked-segment")
        .attr("x", 0)
        .attr("width", barWidth)
        .attr("y", d => y(d.total))
        .attr("height", d => Math.max(0, y(d.allowed) - y(d.total)))
        .attr("fill", blockedBarColor)
        .attr("opacity", 0.98)
        .attr("stroke", "none");

      domainGroups
        .append("rect")
        .attr("class", "bar-outline")
        .attr("x", 0)
        .attr("width", barWidth)
        .attr("y", d => y(d.total))
        .attr("height", d => Math.max(1, height - y(d.total)))
        .attr("fill", "none")
        .attr("stroke", barOutlineColor)
        .attr("stroke-width", 1.1);

      // X-Axis Labels — Straight, smart spacing
      const labelGroup = g
        .append("g")
        .attr("transform", `translate(0,${height + 50})`);
      const spacePerItem = width / domainCount;

      data.forEach((d, i) => {

        let label = d.domain
          .replace(/^www\./, "")
          .replace(
            /^(ads|api|cdn|track|analytics|static|m|mobile)\./,
            ""
          )
          .split(".")[0];

        label = label.charAt(0).toUpperCase() + label.slice(1);
        if (label.length > 18) label = label.slice(0, 16) + "..";

        const x = xIndex(i);
        const fontSize =
          spacePerItem < 60 ? "9px" : spacePerItem < 100 ? "10px" : "11px";

        labelGroup
          .append("text")
          .attr("x", x)
          .attr("y", 0)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "hanging")
          .style("font-size", fontSize)
          .style("fill", labelColor)
          .style("font-family", "system-ui")
          .text(label)
          .append("title")
          .text(d.domain);
      });

      // Interaction overlay
      const hitWidth = Math.max(barWidth, width / domainCount * 0.75);
      const overlay = g
        .selectAll(".hit")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", (d, i) => xIndex(i) - hitWidth / 2)
        .attr("width", hitWidth)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("cursor", "pointer");

      overlay.raise();

      overlay
        .on("mousemove", function (event, d) {
          // Tooltip is centered; event only selects which domain to show
          tooltip.show(buildTooltipHtmlForDomain(d), event);
        })
        .on("mouseout", () => tooltip.hide())
        .on("click", (e, d) => openDomainPanel(d));

      // Legend
      const legend = g
        .append("g")
        .attr("transform", `translate(${width - 120}, -25)`);
      const legendItems = legend
        .selectAll(".legend-item")
        .data([
          { color: allowedBarColor, label: "Allowed" },
          { color: blockedBarColor, label: "Blocked" }
        ])
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 20})`);

      legendItems
        .append("rect")
        .attr("x", -10)
        .attr("y", 0)
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", d => d.color);

      legendItems
        .append("text")
        .attr("x", 8)
        .attr("y", 10)
        .text(d => d.label)
        .attr("fill", labelColor)
        .style("font-size", "12px");
    }

    const ctrl = createControls(container);
    ctrl.setSortHandler(mode => updateChart({ sortMode: mode }));
    ctrl.setSearchHandler(q => updateChart({ searchQuery: q }));

    // Responsive
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() =>
        requestAnimationFrame(() => updateChart())
      ).observe(container);
    } else {
      window.addEventListener("resize", () =>
        requestAnimationFrame(() => updateChart())
      );
    }

    return { updateChart };
  }

  visualization = initializeVisualization();
}

export { visualization };
