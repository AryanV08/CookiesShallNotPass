// ===== Skip visualization entirely while testing =====
let visualization;

if (typeof window !== "undefined" && window.__TEST__) {
  visualization = { updateChart: () => {} };
} else {
  // ================= Helpers =================
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

  function computeDomainModel(state) {
    const map = new Map();
    const blockedMap = state.blockedCookies || {};
    const allowedMap = state.allowedCookies || {};

    for (const [domain, cookies] of Object.entries(blockedMap)) {
      map.set(domain, {
        domain,
        blocked: Object.keys(cookies).length,
        allowed: 0,
        blockedCookies: cookies,
        allowedCookies: {}
      });
    }
    for (const [domain, cookies] of Object.entries(allowedMap)) {
      if (!map.has(domain)) {
        map.set(domain, {
          domain,
          blocked: 0,
          allowed: Object.keys(cookies).length,
          blockedCookies: {},
          allowedCookies: cookies
        });
      } else {
        const row = map.get(domain);
        row.allowed = Object.keys(cookies).length;
        row.allowedCookies = cookies;
      }
    }

    const arr = Array.from(map.values());
    arr.forEach(row => {
      row.total = row.blocked + row.allowed;
    });
    return arr;
  }

  function applyFilterAndSort(model, state) {
    const q = (state.searchQuery || "").trim().toLowerCase();
    let data = q ? model.filter(d => d.domain.toLowerCase().includes(q)) : model.slice();

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

    return `
      <div style="margin-bottom:10px;">
        <div style="font-size:13px; letter-spacing:0.12em; text-transform:uppercase; opacity:0.7;">
          Cookies by Domain
        </div>
        <div style="font-size:17px; font-weight:600; margin-top:4px;">
          ${domainObj.domain}
        </div>
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

  // ================= Neon Gradients & Filters (theme-aware) =================
  function addNeonDefs(svg, totalLineColor, blockedLineColor) {
    const defs = svg.append("defs");

    // Gradients for areas
    const totalGradient = defs
      .append("linearGradient")
      .attr("id", "areaTotalGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    totalGradient
      .selectAll("stop")
      .data([
        { offset: "0%", color: totalLineColor, opacity: 0.35 },
        { offset: "100%", color: totalLineColor, opacity: 0 }
      ])
      .enter()
      .append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color)
      .attr("stop-opacity", d => d.opacity);

    const blockedGradient = defs
      .append("linearGradient")
      .attr("id", "areaBlockedGradient")
      .attr("x1", "0%")
      .attr("y1", "0%")
      .attr("x2", "0%")
      .attr("y2", "100%");
    blockedGradient
      .selectAll("stop")
      .data([
        { offset: "0%", color: blockedLineColor, opacity: 0.45 },
        { offset: "100%", color: blockedLineColor, opacity: 0 }
      ])
      .enter()
      .append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color)
      .attr("stop-opacity", d => d.opacity);

    // Glow filter for lines & dots
    const filter = defs.append("filter").attr("id", "lineGlow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
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
      const totalLineColor =
        (styles.getPropertyValue("--chart-total-line") || "#00E5FF").trim();
      const blockedLineColor =
        (styles.getPropertyValue("--chart-blocked-line") || "#FF8FB3").trim();

      addNeonDefs(svg, totalLineColor, blockedLineColor);
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

      // Areas & Lines
      const totalArea = d3
        .area()
        .x((d, i) => xIndex(i))
        .y0(height)
        .y1(d => y(d.total))
        .curve(d3.curveMonotoneX);

      const blockedArea = d3
        .area()
        .x((d, i) => xIndex(i))
        .y0(height)
        .y1(d => y(d.blocked))
        .curve(d3.curveMonotoneX);

      const totalLine = d3
        .line()
        .x((d, i) => xIndex(i))
        .y(d => y(d.total))
        .curve(d3.curveMonotoneX);

      const blockedLine = d3
        .line()
        .x((d, i) => xIndex(i))
        .y(d => y(d.blocked))
        .curve(d3.curveMonotoneX);

      g.append("path")
        .datum(data)
        .attr("d", totalArea)
        .attr("fill", "url(#areaTotalGradient)")
        .style("mix-blend-mode", "screen");

      g.append("path")
        .datum(data)
        .attr("d", blockedArea)
        .attr("fill", "url(#areaBlockedGradient)")
        .style("mix-blend-mode", "screen");

      g.append("path")
        .datum(data)
        .attr("d", totalLine)
        .attr("stroke", totalLineColor)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("filter", "url(#lineGlow)");

      g.append("path")
        .datum(data)
        .attr("d", blockedLine)
        .attr("stroke", blockedLineColor)
        .attr("stroke-width", 2.5)
        .attr("fill", "none")
        .attr("filter", "url(#lineGlow)");

      // Glowing static dots (no movement, just pulse)
      const dots = g.append("g").attr("class", "dots");

      dots
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", (d, i) => xIndex(i))
        .attr("cy", d => y(d.total))
        .attr("r", 4)
        .attr("fill", totalLineColor)
        .attr("filter", "url(#lineGlow)")
        .style("opacity", 0.9)
        .transition()
        .duration(1600)
        .ease(d3.easeCubicInOut)
        .style("opacity", 0.35)
        .transition()
        .duration(1600)
        .ease(d3.easeCubicInOut)
        .style("opacity", 0.9)
        .on("end", function repeat() {
          d3.select(this)
            .transition()
            .duration(1600)
            .ease(d3.easeCubicInOut)
            .style("opacity", 0.35)
            .transition()
            .duration(1600)
            .ease(d3.easeCubicInOut)
            .style("opacity", 0.9)
            .on("end", repeat);
        });

      // Vertical guide lines on top of the line
      const guideGroup = g.append("g").attr("class", "guides-on-top");
      guideGroup
        .selectAll("line")
        .data(data)
        .enter()
        .append("line")
        .attr("x1", (d, i) => xIndex(i))
        .attr("x2", (d, i) => xIndex(i))
        .attr("y1", d => y(d.total))
        .attr("y2", -20)
        .attr("stroke", totalLineColor)
        .attr("stroke-width", 1.3)
        .attr("opacity", 0.28)
        .attr("filter", "url(#lineGlow)");

      // Grid
      g.append("g")
        .selectAll("line")
        .data(y.ticks(6))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => y(d))
        .attr("y2", d => y(d))
        .attr("stroke", gridColor);

      // X-Axis Labels — Straight, smart spacing
      const labelGroup = g
        .append("g")
        .attr("transform", `translate(0,${height + 50})`);
      const spacePerItem = width / domainCount;
      const skip = spacePerItem < 80 ? Math.ceil(80 / spacePerItem) : 1;

      data.forEach((d, i) => {
        if (i % skip !== 0 && skip > 1) return;

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
      const hitWidth = width / domainCount;
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
      [
        `${totalLineColor}|Total`,
        `${blockedLineColor}|Blocked`
      ].forEach((item, i) => {
        const [color, text] = item.split("|");
        legend
          .append("rect")
          .attr("x", -10)
          .attr("y", i * 20)
          .attr("width", 14)
          .attr("height", 14)
          .attr("rx", 4)
          .attr("fill", color);
        legend
          .append("text")
          .attr("x", 8)
          .attr("y", i * 20 + 10)
          .text(text)
          .attr("fill", labelColor)
          .style("font-size", "12px");
      });
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
