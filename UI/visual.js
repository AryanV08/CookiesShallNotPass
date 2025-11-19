// ===== Skip visualization entirely while testing =====
let visualization;

if (typeof window !== "undefined" && window.__TEST__) {
  visualization = { updateChart: () => {} };
} else {
  // ================= Helpers =================
  function formatCookieFrequencies(cookies) {
    if (!cookies) return "";
    const entries = Object.entries(cookies);
    if (entries.length === 0) return "<small>No cookies recorded yet.</small>";
    return entries
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
    arr.forEach(row => { row.total = row.blocked + row.allowed; });
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

  function createTooltip() {
    d3.select("body").selectAll(".custom-tooltip").remove();

    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "custom-tooltip")
      .style("opacity", 0)
      .style("pointer-events", "none")
      .style("position", "fixed")
      .style("padding", "12px 16px")
      .style("background", "rgba(10, 12, 30, 0.85)") 
      .style("backdrop-filter", "blur(12px)")
      .style("border", "1px solid rgba(255, 255, 255, 0.1)")
      .style("border-left", "3px solid #00E5FF") 
      .style("border-radius", "8px")
      .style("box-shadow", "0 16px 40px rgba(0, 0, 0, 0.6)")
      .style("font-family", "'Inter', sans-serif")
      .style("font-size", "13px")
      .style("color", "#f0f4ff")
      .style("line-height", "1.5")
      .style("min-width", "200px")
      .style("max-width", "320px")
      .style("z-index", "99999")
      .style("transition", "opacity 0.15s ease, transform 0.1s ease");

    return {
      show(html, event, d, i) {
        tooltip.html(html);

        const pointX = (window.currentXScale?.(i) ?? 0) + margin.left + container.getBoundingClientRect().left;
        const pointY = (window.currentYScale?.(d.total) ?? 0) + margin.top + container.getBoundingClientRect().top;

        let left = pointX + 20;
        let top = pointY - 20;

        if (left + 340 > window.innerWidth) left = pointX - 340 - 20;
        if (top - 180 < 0) top = pointY + 30;

        tooltip
          .style("left", left + "px")
          .style("top", top + "px")
          .style("opacity", 1)
          .style("transform", "translateY(0px)");
      },
      hide() {
        tooltip
          .style("opacity", 0)
          .style("transform", "translateY(4px)"); 
      }
    };
  }

  function buildTooltipHtmlForDomain(domainObj) {
    const blockedFreq = formatCookieFrequencies(domainObj.blockedCookies);
    const allowedFreq = formatCookieFrequencies(domainObj.allowedCookies);
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <strong style="color:#fff; font-size:15px; letter-spacing:0.5px;">${domainObj.domain}</strong>
      </div>
      <div style="background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:4px; margin-bottom:8px; display:flex; gap:12px;">
        <span style="color:#00E5FF; font-weight:600;">Total: ${domainObj.total}</span>
        <span style="color:#FF8FB3; font-size:12px; opacity:0.8;">(Blocked: ${domainObj.blocked})</span>
      </div>
      ${blockedFreq ? `<div style="margin-top:8px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px;"><b style="color:#FF8FB3; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Blocked</b><br/>${blockedFreq}</div>` : ""}
      ${allowedFreq ? `<div style="margin-top:6px; border-top:1px solid rgba(255,255,255,0.1); padding-top:6px;"><b style="color:#33f3c1; font-size:11px; text-transform:uppercase; letter-spacing:1px;">Allowed</b><br/>${allowedFreq}</div>` : ""}
    `;
  }

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
      panel.querySelector(".domain-slide-close").addEventListener("click", () => {
        panel.classList.remove("active");
      });
    }
    panel.querySelector(".domain-slide-title").textContent = domainObj.domain;
    const body = panel.querySelector(".domain-slide-body");
    const renderList = (cookies) => {
      if (!cookies || Object.keys(cookies).length === 0) return `<p class="empty-preview">None recorded.</p>`;
      return `<ul class="domain-cookie-list">${Object.entries(cookies)
        .sort(([,a],[,b]) => b - a)
        .slice(0, 40)
        .map(([n,c]) => `<li><span>${n}</span><span>${c}</span></li>`).join("")}</ul>`;
    };
    body.innerHTML = `
      <div class="domain-slide-section"><h4>Blocked cookies (${domainObj.blocked})</h4>${renderList(domainObj.blockedCookies)}</div>
      <div class="domain-slide-section"><h4>Allowed cookies (${domainObj.allowed})</h4>${renderList(domainObj.allowedCookies)}</div>
    `;
    requestAnimationFrame(() => panel.classList.add("active"));
  }

  function createControls(container) {
    let host = container.querySelector(".viz-controls");
    if (!host) {
      host = document.createElement("div");
      host.className = "viz-controls";
      container.prepend(host);
    }
    host.innerHTML = `
      <div class="viz-controls-left">
        <input type="text" class="viz-search" placeholder="Search domains…" aria-label="Search domains"/>
      </div>
      <div class="viz-controls-right">
        <button type="button" data-sort="total" class="viz-sort active">Trend</button>
        <button type="button" data-sort="blocked" class="viz-sort">Blocked</button>
        <button type="button" data-sort="allowed" class="viz-sort">Allowed</button>
        <button type="button" data-sort="az" class="viz-sort">A–Z</button>
      </div>
    `;
    let sortHandler = () => {}, searchHandler = () => {};
    host.querySelectorAll(".viz-sort").forEach(btn => {
      btn.addEventListener("click", () => {
        host.querySelectorAll(".viz-sort").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        sortHandler(btn.dataset.sort);
      });
    });
    const searchInput = host.querySelector(".viz-search");
    if (searchInput) searchInput.addEventListener("input", () => searchHandler(searchInput.value || ""));
    return { setSortHandler: fn => sortHandler = fn, setSearchHandler: fn => searchHandler = fn };
  }

  function addNeonDefs(svg) {
    const defs = svg.append("defs");

    const totalAreaGrad = defs.append("linearGradient")
      .attr("id", "areaTotalGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    
    totalAreaGrad.append("stop").attr("offset", "0%").attr("stop-color", "#00E5FF").attr("stop-opacity", 0.4);
    totalAreaGrad.append("stop").attr("offset", "100%").attr("stop-color", "#00E5FF").attr("stop-opacity", 0.0);

    const blockedAreaGrad = defs.append("linearGradient")
      .attr("id", "areaBlockedGradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    
    blockedAreaGrad.append("stop").attr("offset", "0%").attr("stop-color", "#FF8FB3").attr("stop-opacity", 0.5);
    blockedAreaGrad.append("stop").attr("offset", "100%").attr("stop-color", "#FF8FB3").attr("stop-opacity", 0.0);

    const filter = defs.append("filter").attr("id", "lineGlow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "coloredBlur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
    
    const bgGrad = defs.append("linearGradient").attr("id","chartBgGradient").attr("x2","0%").attr("y2","100%");
    bgGrad.append("stop").attr("offset", "0%").attr("stop-color", "rgba(20, 25, 50, 0.4)");
    bgGrad.append("stop").attr("offset", "100%").attr("stop-color", "rgba(10, 12, 25, 0.1)");
  }

  // ================= Main visualization =================
  let container, margin;

  function initializeVisualization() {
    container = document.querySelector(".visualization-container");
    if (!container) return { updateChart: () => {} };

    const chartRoot = document.querySelector("#chart") || (container.appendChild(document.createElement("div")), document.querySelector("#chart"));
    chartRoot.id = "chart";

    const tooltip = createTooltip();
    margin = { top: 40, right: 40, bottom: 120, left: 40 };

    let lastState = { blockedCookies: {}, allowedCookies: {}, sortMode: "total", searchQuery: "" };

    function updateChart(patch) {
      lastState = { ...lastState, ...patch };
      const model = computeDomainModel(lastState);
      const data = applyFilterAndSort(model, lastState);

      const containerWidth = container.clientWidth || 640;
      const width = Math.max(containerWidth - margin.left - margin.right, 260);
      const height = Math.max(400, 160);

      d3.select(chartRoot).select("svg").remove();
      const svg = d3.select(chartRoot).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);

      addNeonDefs(svg);
      
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      // -- Background --
      g.append("rect")
        .attr("x", -20).attr("y", -20)
        .attr("width", width + 40).attr("height", height + 40)
        .attr("fill", "url(#chartBgGradient)")
        .attr("rx", 12);

      if (!data.length) {
        g.append("text").attr("x", width/2).attr("y", height/2)
          .attr("text-anchor", "middle").attr("fill", "#a3afd6")
          .style("font-size", "14px")
          .text("No cookie data yet. Start browsing to see activity.");
        return;
      }

      const maxTotal = d3.max(data, d => d.total) || 1;
      const xIndex = d3.scaleLinear().domain([0, Math.max(data.length - 1, 1)]).range([0, width]);
      const y = d3.scaleLinear().domain([0, maxTotal * 1.1]).nice().range([height, 0]);

      window.currentXScale = xIndex;
      window.currentYScale = y;

      // -- Curves --
      const totalArea = d3.area().x((d,i) => xIndex(i)).y0(height).y1(d => y(d.total)).curve(d3.curveMonotoneX);
      const blockedArea = d3.area().x((d,i) => xIndex(i)).y0(height).y1(d => y(d.blocked)).curve(d3.curveMonotoneX);
      const totalLine = d3.line().x((d,i) => xIndex(i)).y(d => y(d.total)).curve(d3.curveMonotoneX);
      const blockedLine = d3.line().x((d,i) => xIndex(i)).y(d => y(d.blocked)).curve(d3.curveMonotoneX);

      // -- Grid --
      g.append("g").attr("class", "wave-grid")
        .selectAll("line")
        .data(y.ticks(5))
        .enter().append("line")
        .attr("x1", 0).attr("x2", width)
        .attr("y1", d => y(d)).attr("y2", d => y(d))
        .attr("stroke", "rgba(255,255,255,0.05)")
        .attr("stroke-dasharray", "4 4");

      // -- Areas --
      g.append("path").datum(data)
        .attr("fill", "url(#areaTotalGradient)")
        .attr("d", totalArea)
        .style("mix-blend-mode", "screen")
        .attr("opacity", 0)
        .transition().duration(800).attr("opacity", 1);

      g.append("path").datum(data)
        .attr("fill", "url(#areaBlockedGradient)")
        .attr("d", blockedArea)
        .style("mix-blend-mode", "screen")
        .attr("opacity", 0)
        .transition().duration(800).delay(100).attr("opacity", 1);

      // -- Lines --
      g.append("path").datum(data)
        .attr("fill", "none").attr("stroke", "#00E5FF").attr("stroke-width", 2)
        .attr("filter", "url(#lineGlow)")
        .attr("d", totalLine)
        .attr("stroke-dasharray", function() { return this.getTotalLength(); })
        .attr("stroke-dashoffset", function() { return this.getTotalLength(); })
        .transition().duration(1000).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      g.append("path").datum(data)
        .attr("fill", "none").attr("stroke", "#FF8FB3").attr("stroke-width", 2)
        .attr("filter", "url(#lineGlow)")
        .attr("d", blockedLine)
        .attr("stroke-dasharray", function() { return this.getTotalLength(); })
        .attr("stroke-dashoffset", function() { return this.getTotalLength(); })
        .transition().duration(1000).delay(150).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

      // -- X Axis Labels (CLEANED) --
      const xlabelGroup = g.append("g")
        .attr("class","wave-x-labels")
        .attr("transform", `translate(0, ${height + 30})`);

      data.forEach((d, i) => {
        if (data.length > 20 && i % 2 !== 0) return; 
        
        const x = xIndex(i);
        
        // 1. Remove "www", "ads", etc.
        let label = d.domain.replace(/^www\./, '')
          .replace(/^(ads|analytics|static|cdn|api|track)\./, '');
        
        // 2. Remove TLD (everything after the first dot)
        // "google.com" -> "google"
        label = label.split('.')[0];

        // 3. Format
        label = label.toUpperCase();
        if (label.length > 12) label = label.substring(0, 10) + "..";

        xlabelGroup.append("text")
          .attr("x", x).attr("y", 0)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("fill", i % 2 === 0 ? "#8c9eff" : "#5c6b9f")
          .style("font-size", "11px")
          .style("font-family", "monospace")
          .style("font-weight", "500")
          .style("opacity", 0)
          .attr("transform", `rotate(-45 ${x} 0)`)
          .text(label)
          .transition().duration(500).delay(400 + i * 20).style("opacity", 1);
      });

      // -- Interaction --
      const cursorLine = g.append("line")
        .attr("stroke", "#fff").attr("stroke-width", 1).attr("stroke-dasharray", "3 3")
        .attr("y1", 0).attr("y2", height)
        .style("opacity", 0).style("pointer-events", "none");

      const overlay = g.selectAll(".hover-rect")
        .data(data).enter().append("rect")
        .attr("class", "hover-rect")
        .attr("x", (d, i) => xIndex(i) - (width / data.length) / 2)
        .attr("y", 0)
        .attr("width", width / Math.max(data.length, 1))
        .attr("height", height)
        .attr("fill", "transparent");

      const dots = g.selectAll(".wave-point")
        .data(data).enter().append("circle")
        .attr("cx", (d,i) => xIndex(i))
        .attr("cy", d => y(d.total))
        .attr("r", 4)
        .attr("fill", "#0a0c1c").attr("stroke", "#00E5FF").attr("stroke-width", 2)
        .style("opacity", 0);

      overlay
        .on("mouseover", function(event, d) {
          const i = data.indexOf(d);
          cursorLine.attr("x1", xIndex(i)).attr("x2", xIndex(i)).style("opacity", 0.3);
          const dot = dots.filter((dt, idx) => idx === i);
          dot.style("opacity", 1).transition().duration(200).attr("r", 6).attr("fill", "#00E5FF");
          tooltip.show(buildTooltipHtmlForDomain(d), event, d, i);
        })
        .on("mouseout", function(event, d) {
           cursorLine.style("opacity", 0);
           dots.style("opacity", 0).attr("r", 4).attr("fill", "#0a0c1c");
           tooltip.hide();
        })
        .on("click", (event, d) => openDomainPanel(d));

      // -- Legend --
      const legend = g.append("g").attr("transform", `translate(${width - 10}, -15)`);
      const addLegendItem = (color, text, yOffset) => {
        const grp = legend.append("g").attr("transform", `translate(0, ${yOffset})`);
        grp.append("rect").attr("width", 12).attr("height", 12).attr("rx", 3).attr("fill", color);
        grp.append("text").attr("x", -6).attr("y", 10).text(text)
           .attr("text-anchor", "end").attr("fill", "#b0bcff").style("font-size", "12px");
      };
      addLegendItem("#00E5FF", "Total", 0);
      addLegendItem("#FF8FB3", "Blocked", 20);
    }

    const ctrlAPI = createControls(container);
    ctrlAPI.setSortHandler(mode => updateChart({ sortMode: mode }));
    ctrlAPI.setSearchHandler(query => updateChart({ searchQuery: query }));
    
    if (typeof ResizeObserver !== "undefined") {
      let resizeTimeout;
      const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimeout);
    
        // 🔥 Fix infinite refresh: increase debounce time
        resizeTimeout = setTimeout(() => {
          requestAnimationFrame(() => updateChart(lastState));
        }, 250);  // <-- changed from 66 to 250
      });
    
      ro.observe(container);
    } else {
      window.addEventListener("resize", () =>
        requestAnimationFrame(() => updateChart(lastState))
      );
    }
    
    return { updateChart };
    

    return { updateChart };
  }

  visualization = initializeVisualization();
}

export { visualization };