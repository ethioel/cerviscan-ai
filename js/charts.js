/* ============================================================
   CERVISCAN AI · CHART.JS VISUAL ANALYTICS v2
   Charts live inside display:none pages → lazy-initialized on
   first visit to the Data Hub, resized on every return visit.
   ============================================================ */
(function () {
  const { $ } = window.CERVI.util;
  const D = window.CERVI;
  const charts = {};
  let ready = false;

  Chart.defaults.color = '#98a2b3';
  Chart.defaults.borderColor = 'rgba(255,255,255,.06)';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10,14,20,.95)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,.16)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 12;
  Chart.defaults.plugins.tooltip.titleFont = { family: "'JetBrains Mono', monospace", weight: '700' };
  Chart.defaults.plugins.tooltip.displayColors = false;

  function gradFill(chart, top, bottom) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return top;
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    return g;
  }

  function initCharts() {

    /* 1 · INCIDENCE LEADERBOARD */
    const c1 = $('#chartCountries');
    if (c1) {
      const cs = [...D.countries].sort((a, b) => b.asr - a.asr);
      charts.countries = new Chart(c1, {
        type: 'bar',
        data: {
          labels: cs.map(c => c.name),
          datasets: [{
            data: cs.map(c => c.asr),
            backgroundColor: cs.map(c => c.ethiopia ? '#2dd4bf' : 'rgba(167,139,250,.55)'),
            hoverBackgroundColor: cs.map(c => c.ethiopia ? '#5eead4' : 'rgba(167,139,250,.85)'),
            borderRadius: 8, borderSkipped: false, barThickness: 16
          }]
        },
        options: {
          indexAxis: 'y', maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ` ≈ ${c.parsed.x} per 100,000 women` } }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,.05)' },
                 ticks: { font: { family: "'JetBrains Mono', monospace", size: 10 } } },
            y: { grid: { display: false },
                 ticks: { font: { size: 11, weight: ctx => cs[ctx.index]?.ethiopia ? '700' : '400' },
                          color: ctx => cs[ctx.index]?.ethiopia ? '#6ee7b7' : '#98a2b3' } }
          }
        }
      });
    }

    /* 2 · AFRICA'S GLOBAL SHARE (double-ring doughnut) */
    const c2 = $('#chartShare');
    if (c2) {
      charts.share = new Chart(c2, {
        type: 'doughnut',
        data: {
          datasets: [
            { label: 'Share of global cases',
              data: [D.share.cases, 100 - D.share.cases],
              backgroundColor: ['#2dd4bf', 'rgba(255,255,255,.07)'], borderWidth: 0, weight: 1.15 },
            { label: 'Share of global deaths',
              data: [D.share.deaths, 100 - D.share.deaths],
              backgroundColor: ['#fb7185', 'rgba(255,255,255,.05)'], borderWidth: 0 }
          ]
        },
        options: {
          maintainAspectRatio: false, cutout: '56%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: items => items[0].dataset.label,
              label: item => ` ≈ ${item.parsed}% — ${item.dataIndex === 0 ? 'Africa' : 'rest of world'}`
            } }
          }
        }
      });
    }

    /* 3 · PROJECTION TRAJECTORY 2020 → 2040 */
    const c3 = $('#chartProjection');
    if (c3) {
      charts.projection = new Chart(c3, {
        type: 'line',
        data: {
          labels: D.projections.years,
          datasets: [
            { label: 'New cases (K)', data: D.projections.casesK,
              borderColor: '#2dd4bf', borderWidth: 2.5, pointBackgroundColor: '#2dd4bf',
              pointRadius: 3.5, tension: .35, fill: true,
              backgroundColor: ctx => gradFill(ctx.chart, 'rgba(45,212,191,.30)', 'rgba(45,212,191,0)') },
            { label: 'Deaths (K)', data: D.projections.deathsK,
              borderColor: '#fb7185', borderWidth: 2, borderDash: [6, 5],
              pointBackgroundColor: '#fb7185', pointRadius: 3, tension: .35, fill: false }
          ]
        },
        options: {
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom',
                      labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 16 } },
            tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ≈${c.parsed.y}K` } }
          },
          scales: {
            x: { grid: { display: false } },
            y: { grid: { color: 'rgba(255,255,255,.05)' },
                 ticks: { callback: v => v + 'K',
                          font: { family: "'JetBrains Mono', monospace", size: 10 } } }
          }
        }
      });
    }

    /* 4 · THE SURVIVAL GAP (deaths per 100 new cases) */
    const c4 = $('#chartGap');
    if (c4) {
      charts.gap = new Chart(c4, {
        type: 'bar',
        data: {
          labels: D.survivalGap.labels,
          datasets: [{
            data: D.survivalGap.ratio,
            backgroundColor: ['#2dd4bf', 'rgba(167,139,250,.6)', 'rgba(255,255,255,.18)'],
            hoverBackgroundColor: ['#5eead4', 'rgba(167,139,250,.9)', 'rgba(255,255,255,.3)'],
            borderRadius: 10, borderSkipped: false, maxBarThickness: 56
          }]
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: c => ` ≈${c.parsed.y} deaths per 100 new cases` } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 } } },
            y: { max: 100, grid: { color: 'rgba(255,255,255,.05)' },
                 ticks: { callback: v => v + '%',
                          font: { family: "'JetBrains Mono', monospace", size: 10 } } }
          }
        }
      });
    }
  }

  function boot() {
    if (ready) { Object.values(charts).forEach(c => c.resize()); return; }
    ready = true;
    initCharts();
  }
  document.addEventListener('cervi:page', e => { if (e.detail.id === 'data') boot(); });
  if ($('#page-data')?.classList.contains('active')) boot();
})();