// ===== Skip visualization entirely while testing =====
let visualization;

if (typeof window !== 'undefined' && window.__TEST__) {
  // Mock visualization to prevent D3 errors in tests
  visualization = { updateChart: () => {} };
} else {
  // ===== D3.js visualization setup and functions =====
  function initializeVisualization() {
    const container = document.querySelector('.visualization-container');
    const margin = { top: 20, right: 100, bottom: 30, left: 250 };
    const width = container.clientWidth - margin.left - margin.right - 30; // Account for scrollbar
    const rowHeight = 40; // Height per domain

    // Create tooltip if it doesn't exist
    let tooltip = d3.select('body').select('.tooltip');
    if (tooltip.empty()) {
      tooltip = d3.select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);
    }

    function formatCookieFrequencies(cookies) {
      return Object.entries(cookies)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => `• ${name}: ${count} time${count > 1 ? 's' : ''}`)
        .join('<br/>');
    }

    function updateChart(state) {
      const blockedData = Object.entries(state.blockedCookies || {}).map(([domain, cookies]) => ({
        domain,
        type: 'Blocked',
        count: Object.keys(cookies).length,
        cookies
      }));

      const allowedData = Object.entries(state.allowedCookies || {}).map(([domain, cookies]) => ({
        domain,
        type: 'Allowed',
        count: Object.keys(cookies).length,
        cookies
      }));

      const allDomains = [...new Set([
        ...blockedData.map(d => d.domain),
        ...allowedData.map(d => d.domain)
      ])].sort((a, b) => {
        const aCount = (blockedData.find(d => d.domain === a)?.count || 0) +
                      (allowedData.find(d => d.domain === a)?.count || 0);
        const bCount = (blockedData.find(d => d.domain === b)?.count || 0) +
                      (allowedData.find(d => d.domain === b)?.count || 0);
        return bCount - aCount;
      });

      const height = rowHeight * allDomains.length;

      d3.select('#chart svg').remove();
      const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const y = d3.scaleBand()
        .domain(allDomains)
        .range([0, height])
        .padding(0.1);

      const domainTotals = new Map();
      allDomains.forEach(domain => {
        const blocked = blockedData.find(d => d.domain === domain)?.count || 0;
        const allowed = allowedData.find(d => d.domain === domain)?.count || 0;
        domainTotals.set(domain, blocked + allowed);
      });

      const x = d3.scaleLinear()
        .domain([0, d3.max(Array.from(domainTotals.values()))])
        .range([0, width]);

      const color = d3.scaleOrdinal()
        .domain(['Blocked', 'Allowed'])
        .range(['#e9558a', '#1fc9a4']);

      svg.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '12px');

      svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
          .tickSize(-height)
          .tickFormat(d => d))
        .call(g => g.selectAll('.tick line').attr('stroke-opacity', 0.1))
        .call(g => g.selectAll('.domain').attr('stroke-opacity', 0.5));

      svg.selectAll('.blocked-bar')
        .data(blockedData)
        .enter()
        .append('rect')
        .attr('class', 'blocked-bar')
        .attr('y', d => y(d.domain))
        .attr('x', 0)
        .attr('height', y.bandwidth() / 2)
        .attr('width', d => x(d.count))
        .attr('fill', color('Blocked'))
        .on('mouseover', (event, d) => {
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`<strong>${d.domain}</strong> (Blocked)<br/><small>Total Blocked Cookies: ${d.count}</small><br/>${formatCookieFrequencies(d.cookies)}`)
            .style('left', `${event.clientX + 10}px`)
            .style('top', `${event.clientY + 10}px`);
        })
        .on('mouseout', () => tooltip.transition().duration(200).style('opacity', 0));

      svg.selectAll('.allowed-bar')
        .data(allowedData)
        .enter()
        .append('rect')
        .attr('class', 'allowed-bar')
        .attr('y', d => y(d.domain) + y.bandwidth() / 2)
        .attr('x', 0)
        .attr('height', y.bandwidth() / 2)
        .attr('width', d => x(d.count))
        .attr('fill', color('Allowed'))
        .on('mouseover', (event, d) => {
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`<strong>${d.domain}</strong> (Allowed)<br/><small>Total Allowed Cookies: ${d.count}</small><br/>${formatCookieFrequencies(d.cookies)}`)
            .style('left', `${event.clientX + 10}px`)
            .style('top', `${event.clientY + 10}px`);
        })
        .on('mouseout', () => tooltip.transition().duration(200).style('opacity', 0));

      const legend = svg.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .attr('text-anchor', 'start')
        .selectAll('g')
        .data(['Blocked', 'Allowed'])
        .enter().append('g')
        .attr('transform', (d, i) => `translate(${width + 10},${i * 20 + 10})`);

      legend.append('rect')
        .attr('x', 0)
        .attr('width', 19)
        .attr('height', 19)
        .attr('fill', color);

      legend.append('text')
        .attr('x', 24)
        .attr('y', 9.5)
        .attr('dy', '0.32em')
        .text(d => d);
    }

    return { updateChart };
  }

  visualization = initializeVisualization();
}

export { visualization };
