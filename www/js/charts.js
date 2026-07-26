/*
  charts.js — نمودارهای سبک بدون هیچ کتابخانه خارجی (کاملاً آفلاین)
  چون برنامه نباید به هیچ CDN وابسته باشد، نمودارها با SVG خام رسم می‌شوند.
*/

const Charts = (() => {

  function fmt(n) {
    return Math.round(n).toLocaleString('fa-IR');
  }

  // نمودار خطی روند ورود/خروج پول
  function lineChart(container, series, opts = {}) {
    const w = opts.width || container.clientWidth || 320;
    const h = opts.height || 160;
    const pad = 28;
    const max = Math.max(1, ...series.map((s) => Math.max(s.deposit, s.withdraw)));
    const stepX = series.length > 1 ? (w - pad * 2) / (series.length - 1) : 0;

    function points(key) {
      return series.map((s, i) => {
        const x = pad + i * stepX;
        const y = h - pad - (s[key] / max) * (h - pad * 2);
        return `${x},${y}`;
      }).join(' ');
    }

    const depositPts = points('deposit');
    const withdrawPts = points('withdraw');

    container.innerHTML = `
      <svg viewBox="0 0 ${w} ${h}" class="chart-svg" preserveAspectRatio="none">
        <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="chart-axis" />
        <polyline points="${depositPts}" class="chart-line chart-line--deposit" />
        <polyline points="${withdrawPts}" class="chart-line chart-line--withdraw" />
      </svg>
      <div class="chart-legend">
        <span class="chip chip--deposit">واریز</span>
        <span class="chip chip--withdraw">برداشت</span>
      </div>
    `;
  }

  // نمودار دایره‌ای (Donut) بر اساس دسته‌بندی یا واحد
  function donutChart(container, slices, opts = {}) {
    const size = opts.size || 180;
    const r = size / 2 - 10;
    const cx = size / 2, cy = size / 2;
    const total = slices.reduce((a, s) => a + s.value, 0) || 1;
    let angle = -Math.PI / 2;
    const paths = slices.map((s) => {
      const frac = s.value / total;
      const start = angle;
      const end = angle + frac * Math.PI * 2;
      angle = end;
      const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
      const large = frac > 0.5 ? 1 : 0;
      return `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z" fill="${s.color}" opacity="0.92"><title>${s.label}: ${fmt(s.value)} ریال</title></path>`;
    }).join('');

    container.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" class="donut-svg">
        ${paths}
        <circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--surface)" />
      </svg>
      <ul class="donut-legend">
        ${slices.map((s) => `<li><span class="dot" style="background:${s.color}"></span>${s.label} <b>${fmt(s.value)}</b></li>`).join('')}
      </ul>
    `;
  }

  return { lineChart, donutChart };
})();
