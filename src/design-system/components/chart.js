// ============================================================
//  design-system/components/chart.js — SMARTLAKE DS 3.0 · GRAFIK
//  ------------------------------------------------------------
//  YAGONA SVG grafik dvigateli. Auditda topilgan muammo yechimi:
//  hozir bir xil grafik kodi 3 faylda takrorlangan va inline hex
//  ranglar ishlatilgan. Bu modul BITTA manba bo'ladi — barcha
//  ranglar tokens/charts.css klasslari/o'zgaruvchilari orqali.
//
//  Turlar: slLineChart (line+area, multi-seriya, threshold,
//          interaktiv tooltip) · slBarChart · slPieChart (donut) ·
//          slGaugeChart · slTimeline (sparkline) · slChartLegend
//
//  Kutubxona YO'Q — sof SVG (mavjud yondashuv saqlanadi).
//  Business logic YO'Q — faqat points -> chizma.
// ============================================================

import { el } from '../../shared/dom.js';

/* ---------- SVG yordamchilari ---------- */
const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, props = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'text') node.textContent = String(v);
    else node.setAttribute(k, String(v));
  }
  for (const c of [].concat(children)) { if (c != null) node.appendChild(c); }
  return node;
}

const nice = (v, d = 1) => (v == null || !Number.isFinite(v) ? null : Number(v.toFixed(d)));

/* Chiziqli shkala: domen [d0,d1] -> diapazon [r0,r1]. */
function scale(d0, d1, r0, r1) {
  const span = d1 - d0 || 1;
  return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/* Seriya uchun min/max (padding bilan). */
function extent(values, pad = 0.1) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length) return [0, 1];
  let min = Math.min(...nums); let max = Math.max(...nums);
  if (min === max) { min -= 1; max += 1; }
  const p = (max - min) * pad;
  return [min - p, max + p];
}

/* ------------------------------------------------------------
   LEGEND
   series: [{ key:'do', label:'DO' }] — rang .sl-fill-<key> dan
   ------------------------------------------------------------ */
export function slChartLegend(series) {
  return el('div', { class: 'sl-chart-legend' }, series.map((s) =>
    el('span', {}, [
      el('span', { class: `sl-swatch`, style: `background:var(--sl-chart-${s.key}, var(--sl-chart-1))` }),
      el('span', { text: s.label }),
    ])));
}

/* ------------------------------------------------------------
   TOOLTIP (bitta umumiy)
   ------------------------------------------------------------ */
function makeTooltip() {
  const tip = el('div', { class: 'sl-chart-tooltip', role: 'status' });
  return {
    node: tip,
    show(html, x, y, bounds) {
      tip.innerHTML = html;
      tip.style.display = 'block';
      const w = tip.offsetWidth || 150; const h = tip.offsetHeight || 60;
      let left = x + 12; let top = y - h - 8;
      if (left + w > bounds.width) left = x - w - 12;
      if (top < 0) top = y + 12;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, top)}px`;
    },
    hide() { tip.style.display = 'none'; },
  };
}

/* ------------------------------------------------------------
   LINE / AREA CHART — asosiy tarix grafigi
   @param {object} p
   @param {Array}  p.points  — [{ x:number(ts), [seriesKey]:number }]
   @param {Array}  p.series  — [{ key:'do', label:'DO', unit:'mg/L', area?:true }]
   @param {Function} p.formatX — (x) => 'label'
   @param {Array}  [p.thresholds] — [{ seriesKey, value, label }]
   @param {number} [p.width=600] [p.height=240]
   @param {boolean}[p.animate=true]
   @param {string} [p.ariaLabel]
   ------------------------------------------------------------ */
export function slLineChart({
  points = [], series = [], formatX = (x) => String(x),
  thresholds = [], width = 600, height = 240, animate = true, ariaLabel = '',
} = {}) {
  const wrap = el('div', { style: 'position:relative;width:100%' });
  if (!points.length || !series.length) return wrap;

  const m = { top: 16, right: 16, bottom: 30, left: 38 };
  const iw = width - m.left - m.right;
  const ih = height - m.top - m.bottom;

  const xs = points.map((p) => p.x);
  const sx = scale(Math.min(...xs), Math.max(...xs), m.left, m.left + iw);

  // Har seriya o'z Y shkalasiga ega (DO/temp/pH birliklari har xil)
  const yScales = {};
  series.forEach((s) => {
    const [lo, hi] = extent(points.map((p) => p[s.key]));
    yScales[s.key] = scale(lo, hi, m.top + ih, m.top);
  });

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%',
    role: 'img', 'aria-label': ariaLabel,
    style: 'display:block;overflow:visible',
  });

  // Grid (gorizontal 4 chiziq)
  for (let i = 0; i <= 4; i++) {
    const y = m.top + (ih / 4) * i;
    svg.appendChild(svgEl('line', { class: 'sl-chart-grid', x1: m.left, x2: m.left + iw, y1: y, y2: y }));
  }
  // X o'qi belgilar (maks 6 ta — tor ekranda mingashmaydi)
  const tickCount = Math.min(6, points.length);
  for (let i = 0; i < tickCount; i++) {
    const idx = Math.round((points.length - 1) * (i / Math.max(1, tickCount - 1)));
    const p = points[idx];
    svg.appendChild(svgEl('text', {
      class: 'sl-chart-tick', x: sx(p.x), y: height - 8, 'text-anchor': 'middle',
      text: formatX(p.x),
    }));
  }

  // Threshold chiziqlar
  thresholds.forEach((t) => {
    const yS = yScales[t.seriesKey]; if (!yS) return;
    const y = yS(t.value);
    svg.appendChild(svgEl('line', { class: 'sl-chart-threshold', x1: m.left, x2: m.left + iw, y1: y, y2: y }));
  });

  // Seriyalar
  series.forEach((s) => {
    const yS = yScales[s.key];
    const segs = [];
    let d = ''; let started = false;
    points.forEach((p) => {
      const v = p[s.key];
      if (typeof v !== 'number' || !Number.isFinite(v)) { started = false; return; }
      d += `${started ? 'L' : 'M'}${sx(p.x).toFixed(1)},${yS(v).toFixed(1)} `;
      started = true;
      segs.push(p);
    });
    if (!d) return;

    if (s.area) {
      const first = segs[0]; const last = segs[segs.length - 1];
      const areaD = `${d}L${sx(last.x).toFixed(1)},${m.top + ih} L${sx(first.x).toFixed(1)},${m.top + ih} Z`;
      svg.appendChild(svgEl('path', { class: `sl-chart-area sl-fill-${s.key}`, d: areaD }));
    }
    const path = svgEl('path', { class: `sl-chart-line sl-series-${s.key}`, d });
    if (animate) {
      // chizilish animatsiyasi (reduced-motion'da base.css o'chiradi)
      requestAnimationFrame(() => {
        const len = path.getTotalLength ? path.getTotalLength() : 0;
        if (len) {
          path.style.setProperty('--sl-draw-len', String(len));
          path.style.strokeDasharray = String(len);
          path.style.animation = 'sl-draw var(--sl-motion-slower) var(--sl-ease-out) forwards';
        }
      });
    }
    svg.appendChild(path);
  });

  // Interaktiv qatlam: kursor + nuqtalar + tooltip
  const cursor = svgEl('line', { class: 'sl-chart-cursor', y1: m.top, y2: m.top + ih, style: 'display:none' });
  svg.appendChild(cursor);
  const dots = series.map((s) => {
    const dot = svgEl('circle', { class: `sl-chart-dot sl-series-${s.key}`, r: 5, style: 'display:none' });
    svg.appendChild(dot);
    return { s, dot };
  });
  const tip = makeTooltip();

  function nearest(clientX) {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * width;
    let best = 0; let bestD = Infinity;
    points.forEach((p, i) => {
      const d0 = Math.abs(sx(p.x) - px);
      if (d0 < bestD) { bestD = d0; best = i; }
    });
    return { p: points[best], rect };
  }
  function onMove(ev) {
    const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const { p, rect } = nearest(cx);
    const x = sx(p.x);
    cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
    cursor.style.display = '';
    const rowsHtml = series.map(({ key, label, unit }) => {
      const v = nice(p[key]);
      dots.find((d) => d.s.key === key).dot.style.display = v == null ? 'none' : '';
      if (v != null) {
        const dot = dots.find((d) => d.s.key === key).dot;
        dot.setAttribute('cx', x); dot.setAttribute('cy', yScales[key](p[key]));
      }
      return v == null ? '' : `<div class="tt-row"><span>${label}</span><span class="tt-val">${v}${unit ? ' ' + unit : ''}</span></div>`;
    }).join('');
    tip.show(`<div class="tt-head">${formatX(p.x)}</div>${rowsHtml}`,
      ((x / width) * rect.width), (m.top / height) * rect.height + 20, rect);
  }
  function onLeave() {
    cursor.style.display = 'none';
    dots.forEach((d) => { d.dot.style.display = 'none'; });
    tip.hide();
  }
  svg.addEventListener('mousemove', onMove);
  svg.addEventListener('mouseleave', onLeave);
  svg.addEventListener('touchstart', onMove, { passive: true });
  svg.addEventListener('touchmove', onMove, { passive: true });
  svg.addEventListener('touchend', onLeave);

  wrap.append(svg, tip.node);
  return wrap;
}

/* ------------------------------------------------------------
   BAR CHART
   @param {Array} p.bars — [{ label, value, key?='1' }]
   ------------------------------------------------------------ */
export function slBarChart({ bars = [], width = 600, height = 220, unit = '', ariaLabel = '' } = {}) {
  const wrap = el('div', { style: 'position:relative;width:100%' });
  if (!bars.length) return wrap;
  const m = { top: 14, right: 10, bottom: 28, left: 34 };
  const iw = width - m.left - m.right; const ih = height - m.top - m.bottom;
  const [, hi] = extent(bars.map((b) => b.value), 0.05);
  const sy = scale(0, hi, m.top + ih, m.top);
  const bw = Math.min(48, (iw / bars.length) * 0.62);

  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', role: 'img', 'aria-label': ariaLabel, style: 'display:block' });
  for (let i = 0; i <= 4; i++) {
    const y = m.top + (ih / 4) * i;
    svg.appendChild(svgEl('line', { class: 'sl-chart-grid', x1: m.left, x2: m.left + iw, y1: y, y2: y }));
  }
  const tip = makeTooltip();
  bars.forEach((b, i) => {
    const cx = m.left + (iw / bars.length) * (i + 0.5);
    const y = sy(Math.max(0, b.value ?? 0));
    const rect = svgEl('rect', {
      class: `sl-chart-bar sl-fill-${b.key || '1'}`,
      x: cx - bw / 2, y, width: bw, height: (m.top + ih) - y,
    });
    rect.addEventListener('mouseenter', (ev) => {
      const r = svg.getBoundingClientRect();
      tip.show(`<div class="tt-head">${b.label}</div><div class="tt-row"><span></span><span class="tt-val">${nice(b.value) ?? '—'}${unit ? ' ' + unit : ''}</span></div>`,
        ((cx / width) * r.width), ((y / height) * r.height), r);
    });
    rect.addEventListener('mouseleave', () => tip.hide());
    svg.appendChild(rect);
    svg.appendChild(svgEl('text', { class: 'sl-chart-tick', x: cx, y: height - 8, 'text-anchor': 'middle', text: b.label }));
  });
  wrap.append(svg, tip.node);
  return wrap;
}

/* ------------------------------------------------------------
   PIE / DONUT CHART
   @param {Array} p.slices — [{ label, value, key?='1' }]
   ------------------------------------------------------------ */
export function slPieChart({ slices = [], size = 180, donut = true, ariaLabel = '' } = {}) {
  const wrap = el('div', { style: 'display:flex;justify-content:center' });
  const total = slices.reduce((a, s) => a + (s.value || 0), 0);
  if (!total) return wrap;
  const r = 70; const cx = 90; const cy = 90;
  const svg = svgEl('svg', { viewBox: '0 0 180 180', width: size, height: size, role: 'img', 'aria-label': ariaLabel });
  let a0 = -Math.PI / 2;
  slices.forEach((s) => {
    const frac = (s.value || 0) / total;
    const a1 = a0 + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const x0 = cx + r * Math.cos(a0); const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    svg.appendChild(svgEl('path', {
      class: `sl-fill-${s.key || '1'}`,
      d: `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${large} 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z`,
    }));
    a0 = a1;
  });
  if (donut) {
    svg.appendChild(svgEl('circle', { cx, cy, r: 42, fill: 'var(--sl-card)' }));
    svg.appendChild(svgEl('text', {
      x: cx, y: cy + 6, 'text-anchor': 'middle',
      style: 'font-family:var(--sl-font);font-weight:800;font-size:22px;font-variant-numeric:tabular-nums',
      fill: 'var(--sl-text-primary)', text: String(total),
    }));
  }
  wrap.appendChild(svg);
  return wrap;
}

/* ------------------------------------------------------------
   GAUGE CHART — 270° dumaloq o'lchagich
   colorVar: '--sl-chart-do' kabi token nomi
   ------------------------------------------------------------ */
export function slGaugeChart({ value, min = 0, max = 100, unit = '', label = '',
  colorVar = '--sl-primary', size = 120, ariaLabel = '' } = {}) {
  const v = typeof value === 'number' ? Math.max(min, Math.min(max, value)) : null;
  const pct = v == null ? 0 : (v - min) / (max - min || 1);
  const r = 52; const circ = 2 * Math.PI * r; const arc = circ * 0.75;
  const svg = svgEl('svg', {
    viewBox: '0 0 128 128', width: size, height: size,
    role: 'img', 'aria-label': ariaLabel || `${label} ${v ?? '—'} ${unit}`,
  }, [
    svgEl('circle', {
      cx: 64, cy: 64, r, fill: 'none', stroke: 'var(--sl-gauge-track)',
      'stroke-width': 10, 'stroke-linecap': 'round',
      'stroke-dasharray': `${arc} ${circ}`, transform: 'rotate(135 64 64)',
    }),
    svgEl('circle', {
      cx: 64, cy: 64, r, fill: 'none', stroke: `var(${colorVar})`,
      'stroke-width': 10, 'stroke-linecap': 'round',
      'stroke-dasharray': `${arc * pct} ${circ}`, transform: 'rotate(135 64 64)',
      style: 'transition:stroke-dasharray var(--sl-motion-slower) var(--sl-ease-out)',
    }),
    svgEl('text', {
      x: 64, y: 62, 'text-anchor': 'middle',
      style: 'font-family:var(--sl-font);font-weight:800;font-size:26px;font-variant-numeric:tabular-nums;letter-spacing:-.5px',
      fill: 'var(--sl-text-primary)', text: v == null ? '—' : String(v),
    }),
    svgEl('text', {
      x: 64, y: 82, 'text-anchor': 'middle',
      style: 'font-family:var(--sl-font);font-weight:600;font-size:11px;letter-spacing:.04em',
      fill: 'var(--sl-text-secondary)', text: unit,
    }),
  ]);
  return el('div', { style: 'text-align:center' }, [
    el('div', {}, [svg]),
    label ? el('div', { class: 'sl-body-sm sl-text-secondary', text: label }) : null,
  ].filter(Boolean));
}

/* ------------------------------------------------------------
   TIMELINE / SPARKLINE — mini chiziq (karta ichi)
   ------------------------------------------------------------ */
let sparkSeq = 0;
export function slTimeline({ values = [], seriesKey = '1', w = 120, h = 36, area = true } = {}) {
  const wrap = el('span', { style: 'display:inline-flex' });
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (nums.length < 2) return wrap;
  const [lo, hi] = extent(nums, 0.15);
  const sx = scale(0, values.length - 1, 2, w - 2);
  const sy = scale(lo, hi, h - 2, 2);
  let d = ''; let started = false;
  values.forEach((v, i) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { started = false; return; }
    d += `${started ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(v).toFixed(1)} `;
    started = true;
  });
  const id = `sl-sp${++sparkSeq}`;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, 'aria-hidden': 'true' });
  if (area) {
    const grad = svgEl('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svgEl('stop', { offset: '0%', 'stop-color': `var(--sl-chart-${seriesKey}, var(--sl-chart-1))`, 'stop-opacity': '.28' }),
      svgEl('stop', { offset: '100%', 'stop-color': `var(--sl-chart-${seriesKey}, var(--sl-chart-1))`, 'stop-opacity': '0' }),
    ]);
    svg.appendChild(svgEl('defs', {}, [grad]));
    svg.appendChild(svgEl('path', { d: `${d}L${w - 2},${h - 2} L2,${h - 2} Z`, fill: `url(#${id})` }));
  }
  svg.appendChild(svgEl('path', { class: `sl-chart-line sl-series-${seriesKey}`, d, 'stroke-width': 2 }));
  wrap.appendChild(svg);
  return wrap;
}

export default {
  svgEl, slChartLegend, slLineChart, slBarChart, slPieChart, slGaugeChart, slTimeline,
};
