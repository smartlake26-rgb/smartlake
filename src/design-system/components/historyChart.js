// ============================================================
//  design-system/components/historyChart.js — HISTORY CHART
//  slLineChart ustiga ZOOM + PAN qatlami (reusable).
//  - Zoom In/Out tugmalari (2× qadam), Reset
//  - Pan: ◀ ▶ tugmalari + zoom holatida barmoq/sichqoncha bilan
//    gorizontal surish
//  - Tooltip/threshold/animatsiya slLineChart'dan meros
//  Sof prezentatsiya: nuqtalar kesimi (slice) qayta chiziladi —
//  ma'lumot manbasiga tegilmaydi.
// ============================================================

import { el, mount } from '../../shared/dom.js';
import { slIcon } from './icons.js';
import { slLineChart } from './chart.js';

const MIN_POINTS = 8;      // eng chuqur zoom'da ko'rinadigan minimal nuqta

/**
 * @param {object} p — slLineChart parametrlari + quyidagilar:
 * @param {string} [p.labels.zoomIn/zoomOut/reset/prev/next] — aria matnlari
 */
export function slHistoryChart({
  points = [], series = [], formatX, thresholds = [], height = 200,
  ariaLabel = '', labels = {},
} = {}) {
  const L = { zoomIn: 'Zoom +', zoomOut: 'Zoom −', reset: 'Reset',
    prev: '◀', next: '▶', ...labels };

  let s0 = 0;
  let e0 = points.length;          // [s0, e0) ko'rinadigan oyna
  const frame = el('div', { class: 'sl-chart-frame' });
  const wrap = el('div', {});

  const btn = (html, label, onClick) => {
    const b = el('button', {
      class: 'sl-iconbtn', type: 'button', 'aria-label': label,
      style: 'width:34px;height:34px', html,
    });
    b.addEventListener('click', onClick);
    return b;
  };
  const zoomOutB = btn(slIcon('minus', 16), L.zoomOut, () => zoom(2));
  const zoomInB = btn(slIcon('plus', 16), L.zoomIn, () => zoom(0.5));
  const prevB = btn(slIcon('arrowLeft', 16), L.prev, () => pan(-0.5));
  const nextB = btn(slIcon('chevronRight', 16), L.next, () => pan(0.5));
  const resetB = el('button', { class: 'sl-btn text sm', type: 'button', text: L.reset });
  resetB.addEventListener('click', () => { s0 = 0; e0 = points.length; redraw(); });

  const toolbar = el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-1);justify-content:flex-end;margin-bottom:var(--sl-sp-1)' },
    [zoomOutB, zoomInB, prevB, nextB, resetB]);

  function clamp() {
    const span = e0 - s0;
    if (s0 < 0) { s0 = 0; e0 = Math.min(points.length, span); }
    if (e0 > points.length) { e0 = points.length; s0 = Math.max(0, e0 - span); }
  }
  function zoom(factor) {
    const span = e0 - s0;
    const next = Math.round(span * factor);
    const target = Math.max(MIN_POINTS, Math.min(points.length, next));
    const mid = (s0 + e0) / 2;
    s0 = Math.round(mid - target / 2); e0 = s0 + target;
    clamp(); redraw();
  }
  function pan(frac) {
    const span = e0 - s0;
    if (span >= points.length) return;
    const step = Math.max(1, Math.round(span * Math.abs(frac))) * Math.sign(frac);
    s0 += step; e0 += step;
    clamp(); redraw();
  }

  function redraw() {
    const zoomed = e0 - s0 < points.length;
    zoomOutB.disabled = !zoomed;
    prevB.disabled = !zoomed || s0 <= 0;
    nextB.disabled = !zoomed || e0 >= points.length;
    zoomInB.disabled = e0 - s0 <= MIN_POINTS;
    resetB.style.visibility = zoomed ? 'visible' : 'hidden';
    mount(frame, slLineChart({
      points: points.slice(s0, e0), series, formatX, thresholds, height, ariaLabel,
    }));
  }

  // Pan: zoom holatida gorizontal surish (touch/sichqoncha)
  let dragX = null;
  const onStart = (x) => { if (e0 - s0 < points.length) dragX = x; };
  const onMove = (x) => {
    if (dragX == null) return;
    const w = frame.clientWidth || 1;
    const dxPts = ((dragX - x) / w) * (e0 - s0);
    if (Math.abs(dxPts) >= 1) {
      const step = Math.trunc(dxPts);
      s0 += step; e0 += step; clamp(); redraw();
      dragX = x;
    }
  };
  const onEnd = () => { dragX = null; };
  frame.addEventListener('touchstart', (ev) => onStart(ev.touches[0].clientX), { passive: true });
  frame.addEventListener('touchmove', (ev) => onMove(ev.touches[0].clientX), { passive: true });
  frame.addEventListener('touchend', onEnd, { passive: true });
  frame.addEventListener('mousedown', (ev) => onStart(ev.clientX));
  frame.addEventListener('mousemove', (ev) => { if (ev.buttons === 1) onMove(ev.clientX); });
  frame.addEventListener('mouseup', onEnd);
  frame.addEventListener('mouseleave', onEnd);

  redraw();
  wrap.append(toolbar, frame);
  return wrap;
}

export default { slHistoryChart };
