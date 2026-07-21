// ============================================================
//  shared/ui/gauge.js — SVG dumaloq gauge + mini sparkline v2
//  DS-3: Design System chart tokenlariga o'tkazildi.
//   • Track rangi --gauge-track (dark rejimda avtomatik moslashadi)
//   • Qiymat matni tabular-nums — yangilanishda markazda "titramaydi"
//   • Sparkline ostida yumshoq gradient maydon (chart-area uslubi)
//  API o'ZGARMAGAN: gauge({value,min,max,label,unit,color,size}),
//  sparkline(values, {color,w,h}) — chaqiruvchi kodlar tegilmaydi.
// ============================================================

import { el } from '../dom.js';

let gradSeq = 0;   // har sparkline uchun unikal gradient id

/**
 * Dumaloq gauge (0-100 yoki value/min/max).
 * @returns {Node}
 */
export function gauge({ value, min = 0, max = 100, label = '', unit = '', color = 'var(--md-primary)', size = 128 }) {
  const v = typeof value === 'number' ? Math.max(min, Math.min(max, value)) : null;
  const pct = v == null ? 0 : (v - min) / (max - min);
  const r = 52;
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;                    // 270° gauge
  const dash = arc * pct;
  const rot = 135;                            // boshlanish burchagi
  const svg = `
    <svg viewBox="0 0 128 128" width="${size}" height="${size}">
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="var(--gauge-track)"
        stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${arc} ${circ}" transform="rotate(${rot} 64 64)"/>
      <circle cx="64" cy="64" r="${r}" fill="none" stroke="${color}"
        stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${dash} ${circ}" transform="rotate(${rot} 64 64)"
        style="transition:stroke-dasharray var(--motion-slow) var(--ease-out)"/>
      <text x="64" y="62" text-anchor="middle" font-size="26" font-weight="800"
        fill="var(--md-on-surface)"
        style="font-family:var(--font);font-variant-numeric:tabular-nums;letter-spacing:-.5px">${v == null ? '—' : v}</text>
      <text x="64" y="82" text-anchor="middle" font-size="11" font-weight="600"
        fill="var(--md-on-surface-variant)"
        style="font-family:var(--font);letter-spacing:.04em">${unit}</text>
    </svg>`;
  return el('div', { style: 'text-align:center' }, [
    el('div', { html: svg }),
    ...(label ? [el('div', { class: 't-body-sm muted', text: label })] : []),
  ]);
}

/**
 * Mini sparkline (tarixiy nuqtalar uchun) — chiziq + gradient maydon.
 * @param {number[]} values
 */
export function sparkline(values = [], { color = 'var(--md-primary)', w = 260, h = 56 } = {}) {
  if (!values.length) {
    return el('div', { class: 't-body-sm muted', style: 'text-align:center;padding:16px', text: '—' });
  }
  const min = Math.min(...values); const max = Math.max(...values);
  const span = max - min || 1;
  const coords = values.map((val, i) => {
    const x = (i / (values.length - 1 || 1)) * w;
    const y = h - ((val - min) / span) * (h - 8) - 4;
    return [x, y];
  });
  const pts = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  // Chiziq ostidagi yopiq maydon (gradient bilan "suv" hissi)
  const areaPath = `M ${coords[0][0].toFixed(1)} ${h} `
    + coords.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
    + ` L ${coords[coords.length - 1][0].toFixed(1)} ${h} Z`;
  const gid = `sparkgrad-${++gradSeq}`;
  const svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${areaPath}" fill="url(#${gid})"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return el('div', { html: svg });
}

export default { gauge, sparkline };
