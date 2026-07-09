// ============================================================
//  features/telemetry/views/deviceDetailView.js — Qurilma detali
//  Barcha maydonlar + realtime telemetriya + status + Health Score.
//  History: historyService bilan (24h/7d/30d) — grafik HALI yo'q,
//  hozircha o'lchovlar soni ko'rsatiladi (Sprint-11 grafik uchun seam).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { deviceService } from '../../devices/index.js';
import { lakeService } from '../../lakes/index.js';
import { authStore } from '../../auth/index.js';
import { telemetryService } from '../services/telemetryService.js';
import { historyService, RANGES } from '../services/historyService.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { healthScore } from '../domain/healthScore.js';
import { telemetryAge } from '../domain/freshness.js';
import { statusBadge } from '../components/statusBadge.js';
import { skeletonCards } from '../components/skeleton.js';

function fmtAge(ts) {
  const age = telemetryAge(ts);
  if (age == null) return '—';
  const m = Math.floor(age / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}

function svgEl(tag, props = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'style' && typeof v === 'string') {
      node.style.cssText = v;
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function formatTimeLabel(ts, rk) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  if (rk === '1h') {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (rk === '24h') {
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  if (rk === '7d') {
    const daysUz = ['Yak', 'Dus', 'Ses', 'Chor', 'Pay', 'Jum', 'Sha'];
    return `${daysUz[d.getDay()]} ${pad(d.getDate())}`;
  }
  if (rk === '30d') {
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  }
  if (rk === '365d') {
    const monthsUz = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
    return `${monthsUz[d.getMonth()]} ${d.getFullYear() % 100}`;
  }
  return d.toLocaleDateString();
}
function row(labelKey, value) {
  return el('div', { class: 'set-row' }, [
    el('span', { style: 'color:var(--ink-soft)', text: t(labelKey) }),
    el('span', { style: 'font-weight:600', text: value == null || value === '' ? '—' : String(value) }),
  ]);
}

export function renderDeviceDetail(ctx = {}) {
  const s = authStore.getState();
  const body = el('div', {});
  const root = el('div', { class: 'app' }, [
    el('div', { class: 'topbar with-back' }, [
      el('button', { class: 'topbar-back', html: icon('arrowLeft', 22), onClick: () => ctx.onBack && ctx.onBack() }),
      el('span', { text: t('tm.deviceDetail') }),
    ]),
    el('div', { class: 'auth-wrap' }, [
      body,
      el('button', { class: 'btn ghost', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
    ]),
  ]);

  let device = null;
  let lake = null;
  let tel = null;
  let unsub = null;
  let destroyed = false;

  // --- Tarixiy ma'lumotlar tahlili va interaktiv SVG grafik ---
  const chartContainer = el('div', { style: 'min-height:220px; display:flex; align-items:center; justify-content:center; position:relative; background:var(--md-surface-container-low, #f0f4f8); border-radius:12px; border:1px solid var(--md-outline-variant, #e0e0e0); padding:12px; margin-top:8px; overflow:hidden' });
  const statsEl = el('div', { style: 'margin-top:12px; display:flex; flex-direction:column; gap:8px' });
  let activeRange = '24h';

  function calculateStats(pts) {
    let minDo = Infinity, maxDo = -Infinity, sumDo = 0, countDo = 0;
    let minTemp = Infinity, maxTemp = -Infinity, sumTemp = 0, countTemp = 0;
    let minPh = Infinity, maxPh = -Infinity, sumPh = 0, countPh = 0;
    
    pts.forEach(p => {
      if (p.do != null) {
        const v = Number(p.do);
        if (v < minDo) minDo = v;
        if (v > maxDo) maxDo = v;
        sumDo += v;
        countDo++;
      }
      if (p.t != null) {
        const v = Number(p.t);
        if (v < minTemp) minTemp = v;
        if (v > maxTemp) maxTemp = v;
        sumTemp += v;
        countTemp++;
      }
      if (p.ph != null) {
        const v = Number(p.ph);
        if (v < minPh) minPh = v;
        if (v > maxPh) maxPh = v;
        sumPh += v;
        countPh++;
      }
    });

    return {
      do: countDo ? { min: minDo, max: maxDo, avg: (sumDo / countDo).toFixed(1) } : null,
      temp: countTemp ? { min: minTemp, max: maxTemp, avg: (sumTemp / countTemp).toFixed(1) } : null,
      ph: countPh ? { min: minPh, max: maxPh, avg: (sumPh / countPh).toFixed(1) } : null
    };
  }

  function buildSvgChart(points, range) {
    if (!points || points.length === 0) {
      return el('div', { style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--ink-soft); min-height:180px; width:100%' }, [
        el('div', { style: 'color:var(--md-outline); opacity:0.6; display:flex; justify-content:center; margin-bottom:4px;', html: icon('activity', 36) }),
        el('span', { style: 'font-size:13px; font-weight:600; color:var(--md-on-surface)', text: t('common.noData') }),
        el('span', { style: 'font-size:11px; text-align:center; max-width:260px; opacity:0.7; color:var(--ink-soft)', text: 'Tanlangan vaqt oralig\'ida qurilmadan olingan o\'lchov ma\'lumotlari mavjud emas.' })
      ]);
    }

    const margin = { top: 20, right: 25, bottom: 35, left: 35 };
    const width = 600 - margin.left - margin.right;
    const height = 240 - margin.top - margin.bottom;

    const now = Date.now();
    const startTime = now - RANGES[range];
    const timeSpan = RANGES[range];

    const getX = (ts) => {
      const tsVal = (ts && ts.toMillis) ? ts.toMillis() : (typeof ts === 'number' ? ts : Number(ts));
      if (Number.isNaN(tsVal) || !tsVal) return margin.left;
      const pct = (tsVal - startTime) / timeSpan;
      return margin.left + Math.max(0, Math.min(1, pct)) * width;
    };

    const doMax = Math.max(15, ...points.map(p => Number(p.do) || 0));
    const tempMax = Math.max(40, ...points.map(p => Number(p.t) || 0));
    const phMax = 14;

    const getDoY = (val) => {
      const v = Number(val) || 0;
      return margin.top + height - (Math.max(0, Math.min(doMax, v)) / doMax) * height;
    };

    const getTempY = (val) => {
      const v = Number(val) || 0;
      return margin.top + height - (Math.max(0, Math.min(tempMax, v)) / tempMax) * height;
    };

    const getPhY = (val) => {
      const v = Number(val) || 0;
      return margin.top + height - (Math.max(0, Math.min(phMax, v)) / phMax) * height;
    };

    const gridElements = [];
    
    // Y grid
    for (let i = 0; i <= 4; i++) {
      const y = margin.top + (i / 4) * height;
      gridElements.push(svgEl('line', {
        x1: margin.left,
        y1: y,
        x2: margin.left + width,
        y2: y,
        stroke: 'rgba(0,0,0,0.06)',
        'stroke-width': 1,
        'stroke-dasharray': '2 3'
      }));
    }

    // X grid & labels
    for (let i = 0; i <= 4; i++) {
      const x = margin.left + (i / 4) * width;
      gridElements.push(svgEl('line', {
        x1: x,
        y1: margin.top,
        x2: x,
        y2: margin.top + height,
        stroke: 'rgba(0,0,0,0.06)',
        'stroke-width': 1,
        'stroke-dasharray': '2 3'
      }));

      const labelTs = startTime + (i / 4) * timeSpan;
      const textLabel = formatTimeLabel(labelTs, range);
      gridElements.push(svgEl('text', {
        x: x,
        y: margin.top + height + 18,
        'text-anchor': 'middle',
        fill: '#666',
        'font-size': '10px',
        'font-family': 'monospace'
      }, [document.createTextNode(textLabel)]));
    }

    const lineElements = [];
    const generatePathD = (pts, getY, valKey) => {
      const validPts = pts.filter(p => p[valKey] != null);
      if (validPts.length < 2) return '';
      return 'M ' + validPts.map(p => `${getX(p.ts)} ${getY(p[valKey])}`).join(' L ');
    };

    const doPathD = generatePathD(points, getDoY, 'do');
    const tempPathD = generatePathD(points, getTempY, 't');
    const phPathD = generatePathD(points, getPhY, 'ph');

    if (doPathD) {
      lineElements.push(svgEl('path', {
        d: doPathD,
        stroke: '#2563eb',
        'stroke-width': '2.5',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }
    if (tempPathD) {
      lineElements.push(svgEl('path', {
        d: tempPathD,
        stroke: '#ef4444',
        'stroke-width': '2.5',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }
    if (phPathD) {
      lineElements.push(svgEl('path', {
        d: phPathD,
        stroke: '#10b981',
        'stroke-width': '2.5',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }

    const markers = [];
    points.forEach(p => {
      const px = getX(p.ts);
      if (p.do != null) {
        markers.push(svgEl('circle', { cx: px, cy: getDoY(p.do), r: 3, fill: '#2563eb' }));
      }
      if (p.t != null) {
        markers.push(svgEl('circle', { cx: px, cy: getTempY(p.t), r: 3, fill: '#ef4444' }));
      }
      if (p.ph != null) {
        markers.push(svgEl('circle', { cx: px, cy: getPhY(p.ph), r: 3, fill: '#10b981' }));
      }
    });

    const guideLine = svgEl('line', {
      x1: 0, y1: margin.top, x2: 0, y2: margin.top + height,
      stroke: 'var(--md-primary, #00639b)', 'stroke-width': '1.5', 'stroke-dasharray': '3 3',
      style: 'display:none'
    });

    const hoverCircleDo = svgEl('circle', { r: 5.5, fill: '#2563eb', stroke: '#fff', 'stroke-width': 1.5, style: 'display:none' });
    const hoverCircleTemp = svgEl('circle', { r: 5.5, fill: '#ef4444', stroke: '#fff', 'stroke-width': 1.5, style: 'display:none' });
    const hoverCirclePh = svgEl('circle', { r: 5.5, fill: '#10b981', stroke: '#fff', 'stroke-width': 1.5, style: 'display:none' });

    const chartOuter = el('div', { style: 'position:relative; width:100%; display:flex; flex-direction:column' });
    const tooltip = el('div', {
      style: 'position: absolute; display: none; background: rgba(15, 23, 42, 0.95); color: #fff; padding: 10px 12px; border-radius: 8px; font-size: 11px; pointer-events: none; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.25); line-height: 1.5; min-width: 150px; border: 1px solid rgba(255,255,255,0.1)'
    });

    const svg = svgEl('svg', {
      viewBox: '0 0 600 240', width: '100%', height: '100%',
      style: 'overflow:visible; cursor:crosshair'
    }, [
      svgEl('g', {}, gridElements),
      svgEl('g', {}, lineElements),
      svgEl('g', {}, markers),
      guideLine, hoverCircleDo, hoverCircleTemp, hoverCirclePh
    ]);

    const handleHover = (e) => {
      if (e.type === 'touchmove' || e.type === 'touchstart') {
        if (e.cancelable) e.preventDefault();
      }
      const rect = svg.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY);
      if (clientX == null) return;

      const mouseX = (clientX - rect.left) * (600 / rect.width);
      
      let nearestPt = null;
      let minDist = Infinity;

      points.forEach(pt => {
        const ptX = getX(pt.ts);
        const dist = Math.abs(ptX - mouseX);
        if (dist < minDist) {
          minDist = dist;
          nearestPt = pt;
        }
      });

      if (nearestPt && minDist < 60) {
        const nearestPtX = getX(nearestPt.ts);
        guideLine.setAttribute('x1', nearestPtX);
        guideLine.setAttribute('x2', nearestPtX);
        guideLine.style.display = 'block';

        if (nearestPt.do != null) {
          hoverCircleDo.setAttribute('cx', nearestPtX);
          hoverCircleDo.setAttribute('cy', getDoY(nearestPt.do));
          hoverCircleDo.style.display = 'block';
        } else hoverCircleDo.style.display = 'none';

        if (nearestPt.t != null) {
          hoverCircleTemp.setAttribute('cx', nearestPtX);
          hoverCircleTemp.setAttribute('cy', getTempY(nearestPt.t));
          hoverCircleTemp.style.display = 'block';
        } else hoverCircleTemp.style.display = 'none';

        if (nearestPt.ph != null) {
          hoverCirclePh.setAttribute('cx', nearestPtX);
          hoverCirclePh.setAttribute('cy', getPhY(nearestPt.ph));
          hoverCirclePh.style.display = 'block';
        } else hoverCirclePh.style.display = 'none';

        const pad = (n) => String(n).padStart(2, '0');
        const d = new Date((nearestPt.ts && nearestPt.ts.toMillis) ? nearestPt.ts.toMillis() : nearestPt.ts);
        const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())} (${pad(d.getDate())}.${pad(d.getMonth()+1)})`;

        tooltip.innerHTML = `
          <div style="font-weight:700; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px; margin-bottom:6px; color:#cbd5e1">${timeStr}</div>
          <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:3px">
            <span style="color:#60a5fa; font-weight:600">● DO:</span>
            <span style="font-family:monospace">${nearestPt.do != null ? nearestPt.do.toFixed(2) + ' mg/L' : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:3px">
            <span style="color:#f87171; font-weight:600">● Harorat:</span>
            <span style="font-family:monospace">${nearestPt.t != null ? nearestPt.t.toFixed(1) + ' °C' : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:12px">
            <span style="color:#34d399; font-weight:600">● pH:</span>
            <span style="font-family:monospace">${nearestPt.ph != null ? nearestPt.ph.toFixed(2) : '—'}</span>
          </div>
        `;

        const parentRect = chartOuter.getBoundingClientRect();
        const toolX = clientX - parentRect.left + 15;
        const toolY = clientY - parentRect.top - 20;

        tooltip.style.left = `${Math.min(parentRect.width - 160, Math.max(10, toolX))}px`;
        tooltip.style.top = `${Math.min(parentRect.height - 100, Math.max(10, toolY))}px`;
        tooltip.style.display = 'block';
      } else {
        hideHover();
      }
    };

    const hideHover = () => {
      guideLine.style.display = 'none';
      hoverCircleDo.style.display = 'none';
      hoverCircleTemp.style.display = 'none';
      hoverCirclePh.style.display = 'none';
      tooltip.style.display = 'none';
    };

    svg.addEventListener('mousemove', handleHover);
    svg.addEventListener('mouseleave', hideHover);
    svg.addEventListener('touchmove', handleHover, { passive: false });
    svg.addEventListener('touchstart', handleHover, { passive: false });
    svg.addEventListener('click', handleHover);

    mount(chartOuter, svg, tooltip);
    return chartOuter;
  }

  async function loadRangeData(rk) {
    activeRange = rk;
    rangeButtonsEls.forEach((btn, key) => {
      if (key === rk) {
        btn.style.background = 'var(--md-primary, #00639b)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--md-primary, #00639b)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--md-primary, #00639b)';
        btn.style.borderColor = 'var(--md-outline-variant, #c4c7c5)';
      }
    });

    mount(chartContainer, el('div', { style: 'display:flex; flex-direction:column; align-items:center; gap:8px' }, [
      el('div', { class: 'spinner', style: 'width:20px; height:20px' }),
      el('span', { style: 'font-size:11px; color:var(--ink-soft)', text: t('app.loading') })
    ]));

    statsEl.replaceChildren();

    try {
      const points = await historyService.getHistory(device.id, rk);
      const chart = buildSvgChart(points, rk);
      mount(chartContainer, chart);

      if (points && points.length > 0) {
        const stats = calculateStats(points);
        const buildStatRow = (color, label, sVal, unit) => {
          if (!sVal) return null;
          return el('div', { style: 'display:flex; align-items:center; justify-content:space-between; font-size:12px; padding:6px 10px; background:var(--md-surface-container-high, #f5f5f5); border-radius:8px' }, [
            el('div', { style: 'display:flex; align-items:center; gap:6px' }, [
              el('span', { style: `width:8px; height:8px; border-radius:50%; background:${color}; display:inline-block` }),
              el('span', { style: 'font-weight:600', text: label })
            ]),
            el('div', { style: 'color:var(--ink-soft); font-size:11px' }, [
              document.createTextNode(`Min: `),
              el('span', { style: 'font-family:monospace; font-weight:600; color:var(--ink-dark)', text: String(sVal.min) }),
              document.createTextNode(` | Max: `),
              el('span', { style: 'font-family:monospace; font-weight:600; color:var(--ink-dark)', text: String(sVal.max) }),
              document.createTextNode(` | O'rtacha: `),
              el('span', { style: 'font-family:monospace; font-weight:600; color:var(--md-primary)', text: String(sVal.avg) }),
              document.createTextNode(` ${unit}`)
            ])
          ]);
        };

        const rows = [
          buildStatRow('#2563eb', t('tm.do'), stats.do, 'mg/L'),
          buildStatRow('#ef4444', t('tm.temp'), stats.temp, '°C'),
          buildStatRow('#10b981', t('tm.ph'), stats.ph, '')
        ].filter(Boolean);

        if (rows.length > 0) {
          mount(statsEl,
            el('div', { style: 'font-size:11px; font-weight:700; color:var(--md-primary); margin-bottom:2px', text: 'TANLANGAN DAVR STATISTIKASI' }),
            ...rows
          );
        }
      }
    } catch (e) {
      mount(chartContainer, el('div', { class: 'banner err', text: t(handleError(e, 'history').messageKey) }));
    }
  }

  const rangeButtonsEls = new Map();
  const rangeButtons = Object.keys(RANGES).map((rk) => {
    const b = el('button', {
      style: 'background:transparent; color:var(--md-primary, #00639b); border-radius:20px; border:1px solid var(--md-outline-variant, #c4c7c5); padding:6px 12px; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.2s; outline:none',
      text: t('tm.range_' + rk)
    });
    b.addEventListener('click', () => loadRangeData(rk));
    rangeButtonsEls.set(rk, b);
    return b;
  });

  const history = el('div', { class: 'card', style: 'padding:14px' }, [
    el('div', { style: 'font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:6px' }, [
      el('span', { html: icon('activity', 18), style: 'display:inline-flex; color:var(--md-primary); vertical-align:middle' }),
      el('span', { text: t('tm.history') })
    ]),
    el('div', { style: 'font-size:11px; color:var(--ink-soft); margin-bottom:8px', text: t('tm.historyHint') }),
    el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px' }, rangeButtons),
    chartContainer,
    statsEl
  ]);

  // deviceId yo'q bo'lsa — Firestore'ga bormaymiz, tushunarli holat ko'rsatamiz.
  if (!ctx.deviceId) {
    mount(body, el('div', { class: 'banner err', text: t('error.deviceNotFound') }));
    return root;
  }

  mount(body, skeletonCards(2));

  function render() {
    if (!device) { mount(body, el('div', { class: 'banner err', text: t('error.deviceNotFound') })); return; }
    const th = resolveThresholds(lake);
    const head = el('div', { class: 'card' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', { style: 'font-family:var(--mono);font-weight:800;font-size:16px', text: device.id }),
        statusBadge(deviceStatus(tel, th)),
      ]),
      el('div', { style: 'font-size:13px;color:var(--ink-soft);margin-top:6px', text: `${t('tm.health')}: ${healthScore(tel, th)}/100` }),
    ]);

    const sensors = el('div', { class: 'card' }, [
      el('div', { style: 'font-weight:700;margin-bottom:4px', text: t('tm.sensors') }),
      row('tm.do', tel ? tel.do : null),
      row('tm.temp', tel ? tel.t : null),
      row('tm.ph', tel ? tel.ph : null),
      row('tm.battery', tel && tel.battery != null ? `${tel.battery}%` : null),
      row('tm.rssi', tel && tel.rssi != null ? `${tel.rssi} dBm` : null),
      row('tm.telemetryAge', fmtAge(tel ? tel.ts : null)),
    ]);

    const info = el('div', { class: 'card' }, [
      el('div', { style: 'font-weight:700;margin-bottom:4px', text: t('tm.deviceInfo') }),
      row('tm.firmware', device.firmwareVersion),
      row('tm.gateway', tel ? tel.gwVersion : null),
      row('tm.region', device.region),
      row('tm.lake', lake ? lake.name : null),
      row('tm.owner', device.ownerUid === s.uid ? t('tm.you') : device.ownerUid),
    ]);

    mount(body, head, sensors, info, history);
  }

  async function boot() {
    try {
      device = await deviceService.getDevice(ctx.deviceId);
      if (device && device.lakeId) lake = await lakeService.getLake(device.lakeId);
    } catch (e) {
      mount(body, el('div', { class: 'banner err', text: t(handleError(e, 'device.load').messageKey) }));
      return;
    }
    if (destroyed) return;

    loadRangeData('24h');

    unsub = telemetryService.watchByOwner(s.uid, ({ telemetry }) => {
      tel = telemetry.get(ctx.deviceId) || null;
      render();
    }, () => render());
    render();
  }
  boot();

  root.__cleanup = () => { destroyed = true; if (unsub) unsub(); };
  return root;
}

export default renderDeviceDetail;
