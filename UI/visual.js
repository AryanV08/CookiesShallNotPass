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
      .style("padding", "11px 15px")
      .style("background", "rgba(10, 12, 28, 0.97)")
      .style("backdrop-filter", "blur(20px)")
      .style("border", "1px solid rgba(140, 107, 255, 0.4)")
      .style("border-radius", "14px")
      .style("box-shadow", "0 16px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(140, 107, 255, 0.25)")
      .style("font-size", "13.5px")
      .style("font-weight", "500")
      .style("color", "#f0f4ff")
      .style("line-height", "1.5")
      .style("min-width", "200px")
      .style("max-width", "320px")
      .style("z-index", "99999")
      .style("transition", "opacity 0.18s ease");

    return {
      show(html, event, d, i) {
        tooltip.html(html);

        const pointX = (window.currentXScale?.(i) ?? 0) + margin.left + container.getBoundingClientRect().left;
        const pointY = (window.currentYScale?.(d.total) ?? 0) + margin.top + container.getBoundingClientRect().top;

        let left = pointX + 18;
        let top = pointY - 20;

        if (left + 340 > window.innerWidth) left = pointX - 340 - 18;
        if (top - 180 < 0) top = pointY + 30;

        tooltip
          .style("left", left + "px")
          .style("top", top + "px")
          .style("opacity", 1);
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
      <strong style="color:#8c6bff;font-size:15px;">${domainObj.domain}</strong>
      <small style="opacity:0.9;">Total: ${domainObj.total} (Blocked: ${domainObj.blocked}, Allowed: ${domainObj.allowed})</small>
      ${blockedFreq ? `<div style="margin-top:8px;"><b style="color:#ff8fb3;">Blocked cookies:</b><br/>${blockedFreq}</div>` : ""}
      ${allowedFreq ? `<div style="margin-top:6px;"><b style="color:#33f3c1;">Allowed cookies:</b><br/>${allowedFreq}</div>` : ""}
    `;
  }

  function openDomainPanel(domainObj) {
    // ... (your existing panel code – unchanged)
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
    // ... (unchanged – your existing controls)
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
        <button type="button" data-sort="total" class="viz-sort active">Most cookies</button>
        <button type="button" data-sort="blocked" class="viz-sort">Blocked</button>
        <button type="button" data-sort="allowed" class="viz-sort">Allowed</button>
        <button type="button" data-sort="az" class="viz-sort">A–Z</button>
        <button type="button" data-sort="za" class="viz-sort">Z–A</button>
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

  function addNeonDefs(svg, width, height) {
    // ... (your existing neon defs – unchanged)
    const defs = svg.append("defs");
    const totalGrad = defs.append("linearGradient").attr("id", "waveTotalGradient").attr("x1","0%").attr("x2","100%");
    [{offset:"0%",color:"#0048FF"},{offset:"50%",color:"#0095FF"},{offset:"100%",color:"#00E5FF"}].forEach(s=>totalGrad.append("stop").attr(s));
    const blockedGrad = defs.append("linearGradient").attr("id", "waveBlockedGradient").attr("x1","0%").attr("x2","100%");
    [{offset:"0%",color:"#7B1E61"},{offset:"50%",color:"#E9558A"},{offset:"100%",color:"#FF8FB3"}].forEach(s=>blockedGrad.append("stop").attr(s));
    defs.append("filter").attr("id","waveGlow").html(`<feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur"/><feColorMatrix in="blur" values="0 0 0 0 0   0 0 0 0 0.8   0 0 0 0 1   0 0 0 1 0" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>`);
    const bgGrad = defs.append("linearGradient").attr("id","waveBackgroundGradient").attr("x2","0%").attr("y2","100%");
    [{offset:"0%",color:"rgba(5,10,30,0.6)"},{offset:"100%",color:"rgba(5,10,30,0)"}].forEach(s=>bgGrad.append("stop").attr(s));
    const particles = svg.append("g").attr("class","wave-particles");
    d3.range(50).forEach(() => particles.append("circle").attr("cx",Math.random()*(width+200)-100).attr("cy",Math.random()*(height+80)-40).attr("r",Math.random()*2.2).attr("fill","#00AFFF").attr("opacity",Math.random()*0.25+0.05));
  }

  // ================= Main visualization =================
  let container, margin;

  function initializeVisualization() {
    container = document.querySelector(".visualization-container");
    if (!container) return { updateChart: () => {} };

    const chartRoot = document.querySelector("#chart") || (container.appendChild(document.createElement("div")), document.querySelector("#chart"));
    chartRoot.id = "chart";

    const tooltip = createTooltip();
    margin = { top: 40, right: 120, bottom: 140, left: 40 };

    let lastState = { blockedCookies: {}, allowedCookies: {}, sortMode: "total", searchQuery: "" };

    function updateChart(patch) {
      lastState = { ...lastState, ...patch };
      const model = computeDomainModel(lastState);
      const data = applyFilterAndSort(model, lastState);

      const containerWidth = container.clientWidth || 640;
      const width = Math.max(containerWidth - margin.left - margin.right - 30, 260);
      const height = Math.max(400, 160);

      d3.select(chartRoot).select("svg").remove();
      const svg = d3.select(chartRoot).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom + 140); // extra space for labels

      addNeonDefs(svg, width, height);
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      g.append("rect")
        .attr("x", -40).attr("y", -30)
        .attr("width", width + 80).attr("height", height + 70)
        .attr("fill", "url(#waveBackgroundGradient)").attr("rx", 24);

      if (!data.length) {
        g.append("text").attr("x", width/2).attr("y", height/2)
          .attr("text-anchor", "middle").attr("fill", "#a3afd6")
          .style("font-size", "14px")
          .text("No cookie data yet. Start browsing to see activity.");
        return;
      }

      const maxTotal = d3.max(data, d => d.total) || 1;
      const xIndex = d3.scaleLinear().domain([0, Math.max(data.length - 1, 1)]).range([0, width]);
      const y = d3.scaleLinear().domain([0, maxTotal]).nice().range([height, 0]);

      // Save scales for tooltip
      window.currentXScale = xIndex;
      window.currentYScale = y;

      const totalArea = d3.area().x((d,i)=>xIndex(i)).y0(height).y1(d=>y(d.total)).curve(d3.curveCatmullRom.alpha(0.8));
      const blockedArea = d3.area().x((d,i)=>xIndex(i)).y0(height).y1(d=>y(d.blocked)).curve(d3.curveCatmullRom.alpha(0.8));

      g.append("g").attr("class","wave-grid").selectAll("line").data(y.ticks(4)).enter().append("line")
        .attr("x1",0).attr("x2",width).attr("y1",d=>y(d)).attr("y2",d=>y(d))
        .attr("stroke","rgba(255,255,255,0.07)");

      g.append("path").datum(data).attr("class","wave-total")
        .attr("fill","url(#waveTotalGradient)").attr("fill-opacity",0.6)
        .attr("stroke","#00E5FF").attr("stroke-width",1.5).attr("filter","url(#waveGlow)")
        .attr("d",totalArea).attr("opacity",0)
        .transition().duration(700).attr("opacity",1);

      g.append("path").datum(data).attr("class","wave-blocked")
        .attr("fill","url(#waveBlockedGradient)").attr("fill-opacity",0.45)
        .attr("stroke","#FF8FB3").attr("stroke-width",1).attr("filter","url(#waveGlow)")
        .attr("d",blockedArea).attr("opacity",0)
        .transition().duration(700).delay(100).attr("opacity",1);

      // ——— ROTATED LABELS UNDER CHART ———
      const xlabelGroup = g.append("g")
        .attr("class","wave-x-labels")
        .attr("transform", `translate(0, ${height + 50})`);

      data.forEach((d, i) => {
        const x = xIndex(i);
        let label = d.domain.replace(/^www\./, '')
          .replace(/^(ads|analytics|static|cdn|api|track|pixel|metrics|beacon|telemetry)\./, '')
          .replace(/\.(com|net|org|io|co|uk|de|fr|eu|app|dev|xyz|online|store|cloud|live|site|shop|tech).*$/i, '');
        if (!label || label.length < 2) label = d.domain.split('.')[0];
        label = label.toUpperCase();
        if (label.length > 14) label = label.substring(0,11) + "...";

        xlabelGroup.append("text")
          .attr("x", x).attr("y", 0)
          .attr("text-anchor", "end").attr("dominant-baseline", "middle")
          .attr("fill", "#b0bcff").style("font-size","10.5px").style("font-weight","600")
          .style("letter-spacing","0.8px").style("pointer-events","none")
          .style("opacity",0)
          .attr("transform", `rotate(-45 ${x} 0)`)
          .text(label)
          .transition().duration(700).delay(400 + i*40).style("opacity",0.9);
      });

      // ——— INTERACTIVE POINTS ———
      const points = g.selectAll(".wave-point").data(data, d => d.domain).join(
        enter => enter.append("circle")
          .attr("class","wave-point")
          .attr("cx",(d,i)=>xIndex(i)).attr("cy",d=>y(d.total))
          .attr("r",0).attr("fill","#00E5FF").attr("stroke","#ffffff").attr("stroke-width",1)
          .call(enter => enter.transition().duration(500).delay(200).attr("r",5))
      );

      points
        .on("mouseover", function(event, d) {
          d3.select(this).raise().transition().duration(180).attr("r",10);
          d3.selectAll(".wave-point").classed("dimmed", true);
          d3.select(this).classed("dimmed", false);
          tooltip.show(buildTooltipHtmlForDomain(d), event, d, data.indexOf(d));
        })
        .on("mousemove", (event, d) => tooltip.show(buildTooltipHtmlForDomain(d), event, d, data.indexOf(d)))
        .on("mouseout", function() {
          d3.selectAll(".wave-point").classed("dimmed", false);
          d3.select(this).transition().duration(200).attr("r",5);
          tooltip.hide();
        })
        .on("click", (event, d) => openDomainPanel(d));

      // Legend
      const legend = g.append("g").selectAll("g").data([
        {label:"Total cookies",color:"#00E5FF"},
        {label:"Blocked cookies",color:"#FF8FB3"}
      ]).enter().append("g")
        .attr("transform",(d,i)=>`translate(${width-20},${i*22-8})`);
      legend.append("circle").attr("r",6).attr("fill",d=>d.color);
      legend.append("text").attr("x",12).attr("y",1).text(d=>d.label).attr("fill","#d0dcff");
    }

    const ctrlAPI = createControls(container);
    ctrlAPI.setSortHandler(mode => updateChart({ sortMode: mode }));
    ctrlAPI.setSearchHandler(query => updateChart({ searchQuery: query }));

    if (typeof ResizeObserver !== "undefined") {
      let resizeTimeout;
      const ro = new ResizeObserver(() => {
        // This completely eliminates the "ResizeObserver loop completed" error
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          requestAnimationFrame(() => updateChart(lastState));
        }, 66); // ~60fps debounce
      });
      ro.observe(container);
    } else {
      // Fallback for very old browsers
      let ticking = false;
      window.addEventListener("resize", () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            updateChart(lastState);
            ticking = false;
          });
          ticking = true;
        }
      });
    }

    return { updateChart };
  }

  visualization = initializeVisualization();
}

export { visualization };