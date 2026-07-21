// ============================================================
//  features/telemetry/views/deviceDetailPage.js — Qurilma tafsilotlari
//  Realtime sensor gauge'lari + barcha maydonlar + history sparkline.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import {
  appBar, mdIconButton, mdCard, statusChip, sensorCard, listItem, skeletonCards, emptyState, mdButton,
} from '../../../shared/ui/index.js';
import { gauge, sparkline } from '../../../shared/ui/gauge.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { authStore } from '../../auth/index.js';
import { historyService, RANGES } from '../services/historyService.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { healthScore } from '../domain/healthScore.js';
import { telemetryAge, presence } from '../domain/freshness.js';
import { renderCommandPanel } from '../../commands/index.js';
import { COMMAND_TYPES } from '../../../core/collections.js';
import { commandService } from '../../commands/services/commandService.js';
import { createAckTracker } from '../../commands/domain/ackTracker.js';
import { toast } from '../../../shared/toast.js';

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

function fmtAge(ts) {
  const age = telemetryAge(ts);
  if (age == null) return '—';
  const m = Math.floor(age / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}

export function renderDeviceDetailPage(nav, deviceId) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title t-mono', text: deviceId || '—' });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }), el('div', { class: 'grow' }, [titleEl])]),
    content,
  ]);

  if (!deviceId) { mount(content, emptyState({ icon: 'chip', title: t('error.deviceNotFound') })); return root; }

  const cmdPanel = renderCommandPanel(deviceId, s.uid);   // bir marta (o'z listeneri bilan)

  // --- QURILMA TASDIG'I: aerator tugmalari uchun (render'dan tashqarida yashaydi) ---
  const pageAck = createAckTracker((state) => {
    if (state === 'waiting')  toast(t('cmd.waitAck'), 'info');
    if (state === 'saved')    toast(t('cmd.savedOk'), 'ok');
    if (state === 'timeout')  toast(t('cmd.ackTimeout'), 'err');
    if (state === 'rejected') toast(t('cmd.ackRejected'), 'err');
  });

  // --- Tarixiy ma'lumotlar tahlili va interaktiv SVG grafik ---
  const chartContainer = el('div', { style: 'min-height:220px; display:flex; align-items:center; justify-content:center; position:relative; background:var(--md-surface-container-lowest); border-radius:var(--shape-md); border:1px solid var(--md-outline-variant); padding:12px; margin-top:8px; overflow:hidden' });
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
        stroke: 'var(--chart-grid)',
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
        stroke: 'var(--chart-grid)',
        'stroke-width': 1,
        'stroke-dasharray': '2 3'
      }));

      const labelTs = startTime + (i / 4) * timeSpan;
      const textLabel = formatTimeLabel(labelTs, range);
      gridElements.push(svgEl('text', {
        x: x,
        y: margin.top + height + 18,
        'text-anchor': 'middle',
        fill: 'var(--chart-label)',
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
        stroke: 'var(--chart-do)',
        'stroke-width': '2.5',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }
    if (tempPathD) {
      lineElements.push(svgEl('path', {
        d: tempPathD,
        stroke: 'var(--chart-temp)',
        'stroke-width': '2.5',
        fill: 'none',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      }));
    }
    if (phPathD) {
      lineElements.push(svgEl('path', {
        d: phPathD,
        stroke: 'var(--chart-ph)',
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
        markers.push(svgEl('circle', { cx: px, cy: getDoY(p.do), r: 3, fill: 'var(--chart-do)' }));
      }
      if (p.t != null) {
        markers.push(svgEl('circle', { cx: px, cy: getTempY(p.t), r: 3, fill: 'var(--chart-temp)' }));
      }
      if (p.ph != null) {
        markers.push(svgEl('circle', { cx: px, cy: getPhY(p.ph), r: 3, fill: 'var(--chart-ph)' }));
      }
    });

    const guideLine = svgEl('line', {
      x1: 0, y1: margin.top, x2: 0, y2: margin.top + height,
      stroke: 'var(--md-primary)', 'stroke-width': '1.5', 'stroke-dasharray': '3 3',
      style: 'display:none'
    });

    const hoverCircleDo = svgEl('circle', { r: 5.5, fill: 'var(--chart-do)', stroke: 'var(--chart-dot)', 'stroke-width': 2, style: 'display:none' });
    const hoverCircleTemp = svgEl('circle', { r: 5.5, fill: 'var(--chart-temp)', stroke: 'var(--chart-dot)', 'stroke-width': 2, style: 'display:none' });
    const hoverCirclePh = svgEl('circle', { r: 5.5, fill: 'var(--chart-ph)', stroke: 'var(--chart-dot)', 'stroke-width': 2, style: 'display:none' });

    const chartOuter = el('div', { style: 'position:relative; width:100%; display:flex; flex-direction:column' });
    const tooltip = el('div', {
      style: 'position: absolute; display: none; background: rgba(6, 26, 22, 0.96); color: #fff; padding: 10px 12px; border-radius: 8px; font-size: 11px; pointer-events: none; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.25); line-height: 1.5; min-width: 150px; border: 1px solid rgba(79,216,194,0.18)'
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
          <div style="font-weight:700; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:4px; margin-bottom:6px; color:#9FEBDB">${timeStr}</div>
          <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:3px">
            <span style="color:#4FD8C2; font-weight:600">● DO:</span>
            <span style="font-family:monospace">${nearestPt.do != null ? nearestPt.do.toFixed(2) + ' mg/L' : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:12px; margin-bottom:3px">
            <span style="color:#F0955C; font-weight:600">● Harorat:</span>
            <span style="font-family:monospace">${nearestPt.t != null ? nearestPt.t.toFixed(1) + ' °C' : '—'}</span>
          </div>
          <div style="display:flex; justify-content:space-between; gap:12px">
            <span style="color:#B79CF0; font-weight:600">● pH:</span>
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
        btn.style.background = 'var(--md-primary)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--md-primary)';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--md-primary)';
        btn.style.borderColor = 'var(--md-outline-variant)';
      }
    });

    mount(chartContainer, el('div', { style: 'display:flex; flex-direction:column; align-items:center; gap:8px' }, [
      el('div', { class: 'spinner', style: 'width:20px; height:20px' }),
      el('span', { style: 'font-size:11px; color:var(--ink-soft)', text: t('app.loading') })
    ]));

    statsEl.replaceChildren();

    try {
      const points = await historyService.getHistory(deviceId, rk);
      const chart = buildSvgChart(points, rk);
      mount(chartContainer, chart);

      if (points && points.length > 0) {
        const stats = calculateStats(points);
        const buildStatRow = (color, label, sVal, unit) => {
          if (!sVal) return null;
          return el('div', { style: 'display:flex; align-items:center; justify-content:space-between; font-size:12px; padding:6px 10px; background:var(--md-surface-container); border-radius:8px' }, [
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
          buildStatRow('var(--chart-do)', t('tm.do'), stats.do, 'mg/L'),
          buildStatRow('var(--chart-temp)', t('tm.temp'), stats.temp, '°C'),
          buildStatRow('var(--chart-ph)', t('tm.ph'), stats.ph, '')
        ].filter(Boolean);

        if (rows.length > 0) {
          mount(statsEl,
            el('div', { style: 'font-size:11px; font-weight:700; color:var(--md-primary); margin-bottom:4px', text: 'TANLANGAN DAVR STATISTIKASI' }),
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
      style: 'background:transparent; color:var(--md-primary); border-radius:20px; border:1px solid var(--md-outline-variant); padding:6px 12px; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.2s; outline:none',
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

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const device = st.devices.find((d) => d.id === deviceId);
    if (!device) { mount(content, emptyState({ icon: 'chip', title: t('error.deviceNotFound') })); return; }
    const lake = st.lakes.find((l) => l.id === device.lakeId);
    const th = resolveThresholds(lake);
    const tel = st.telemetry.get(deviceId) || null;
    pageAck.feed(tel);   // qurilma tasdig'ini tekshirish
    const status = deviceStatus(tel, th);

    const score = healthScore(tel, th);
    const isDeviceCritical = score <= 60;
    const isOnline = tel ? (presence(tel.ts, Date.now(), th) === 'online') : false;

    const header = mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title-sm muted', text: `${t('tm.health')}: ${score}/100` }),
        statusChip(status, t('tm.status_' + status)),
      ]),
      el('div', { class: 'row', style: 'justify-content:space-around;margin-top:8px' }, [
        gauge({ value: tel ? tel.do : null, min: 0, max: 15, unit: 'DO', color: 'var(--chart-do)', size: 110 }),
        gauge({ value: tel ? tel.t : null, min: 0, max: 40, unit: '°C', color: 'var(--chart-temp)', size: 110 }),
      ]),
    ], { elevated: true, cls: isDeviceCritical ? 'bento-cell-critical' : '' });

    const sensors = el('div', { class: 'sensor-grid' }, [
      sensorCard({ label: 'pH', value: tel ? tel.ph : null, status, isLive: isOnline }),
      sensorCard({ label: t('tm.battery'), value: tel && tel.battery != null ? tel.battery : null, unit: '%', isLive: isOnline }),
      sensorCard({ label: t('tm.rssi'), value: tel && tel.rssi != null ? tel.rssi : null, unit: 'dBm', isLive: isOnline }),
      sensorCard({ label: t('tm.telemetryAge'), value: fmtAge(tel ? tel.ts : null), isLive: isOnline }),
    ]);

    const info = mdCard([
      el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('tm.deviceInfo') }),
      el('div', { class: 'md-list' }, [
        listItem({ leading: 'chip', title: device.firmwareVersion || '—', subtitle: t('tm.firmware') }),
        listItem({ leading: 'wifi', title: tel && tel.gwVersion ? tel.gwVersion : '—', subtitle: t('tm.gateway') }),
        listItem({ leading: 'location', title: device.region || '—', subtitle: t('tm.region') }),
        listItem({ leading: 'droplet', title: lake ? lake.name : t('device.unassigned'), subtitle: t('tm.lake') }),
      ]),
    ]);

    // GW-FIX: firmware telemetriya maydonlari — aer (rele holati), manual
    // (qo'lda rejim bayrog'i), mode (0=kislorod avto, 1=vaqt jadvali).
    // Avvalgi kod mavjud bo'lmagan tel.aerator/tel.auto ni o'qib, doim
    // noto'g'ri holat ko'rsatardi.
    const isAeratorOn = tel && tel.aer === 1;
    const isManual    = tel && tel.manual === 1;
    const isVaqtMode  = tel && tel.mode === 1;
    const isAutoMode  = !isManual;

    // GW-FIX: QURILMA CHEGARALARI kartasi — node klaviaturasidan yoki
    // ilovadan kiritilgan joriy qiymatlar (har telemetriyada keladi).
    const fmtMg = (v) => (typeof v === 'number' && Number.isFinite(v)) ? `${v} mg/L` : '—';
    const manRemainTxt = tel && typeof tel.man_remain === 'number' && tel.man_remain > 0
      ? ` (${tel.man_remain} daq qoldi)` : '';
    const thresholdsCard = mdCard([
      el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:8px' }, [
        el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
          el('span', { html: icon('droplet', 18), style: 'color:var(--md-primary); display:inline-flex' }),
          el('span', { style: 'font-weight:700; font-size:15px; color:var(--md-on-surface)', text: 'Qurilma sozlamalari (kislorod)' }),
        ]),
        tel && tel.alarm === 1
          ? statusChip('critical', 'ALARM')
          : statusChip('healthy', 'NORMAL'),
      ]),
      el('div', { class: 'sensor-grid' }, [
        sensorCard({ label: 'Minimal DO',  value: tel && typeof tel.mindo  === 'number' ? tel.mindo  : null, unit: 'mg/L', isLive: isOnline }),
        sensorCard({ label: 'Yetarli farq', value: tel && typeof tel.farqdo === 'number' ? tel.farqdo : null, unit: 'mg/L', isLive: isOnline }),
        sensorCard({ label: 'Kritik DO',   value: tel && typeof tel.kritik === 'number' ? tel.kritik : null, unit: 'mg/L', isLive: isOnline }),
      ]),
      el('p', { style: 'font-size:11.5px; line-height:1.4; color:var(--md-on-surface-variant); margin:8px 0 0', 
        text: `Ishlash mantig'i: DO ${fmtMg(tel ? tel.mindo : null)} dan tushsa aerator yoqiladi, ${
          tel && typeof tel.mindo === 'number' && typeof tel.farqdo === 'number' ? fmtMg(tel.mindo + tel.farqdo) : '—'
        } ga chiqsa o'chadi. ${fmtMg(tel ? tel.kritik : null)} dan pastda ALARM. Qiymatlar qurilma xotirasidan — klaviatura yoki ilovadan o'zgartirilsa shu yerda yangilanadi.` }),
    ], { elevated: true });

    const turnOnBtn = mdButton({
      label: "Majburiy yoqish",
      icon: 'power',
      variant: isManual ? 'filled' : 'outlined',
      onClick: () => sendCommand(COMMAND_TYPES.AERATOR_ON)
    });

    // GW-FIX: firmware'da majburiy "o'chirish" yo'q — aer:0 avto rejimga
    // qaytaradi (kislorod yetarli bo'lsa node o'zi o'chiradi).
    const autoBtn = mdButton({
      label: "Avto rejimga qaytarish",
      icon: 'activity',
      variant: isAutoMode ? 'filled' : 'outlined',
      onClick: () => sendCommand(COMMAND_TYPES.AERATOR_OFF)
    });

    async function sendCommand(type) {
      toast("Buyruq yuborilmoqda...", 'info');
      try {
        await commandService.createCommand({ deviceId, commandType: type, payload: null }, s.uid);
        // "Yuborildi" emas — endi haqiqiy tasdiqni kutamiz:
        // qurilma ACK qaytarganda yashil "qurilmada saqlandi" chiqadi.
        pageAck.expect(type);
        await dataStore.refresh();
      } catch (e) {
        toast("Xatolik: " + e.message, 'err');
      }
    }

    const aeratorControlCard = mdCard([
      el('div', { style: 'display:flex; align-items:center; justify-content:space-between; margin-bottom:12px' }, [
        el('div', { style: 'display:flex; align-items:center; gap:8px' }, [
          el('span', { html: icon('waves', 18), style: 'color:var(--md-primary); display:inline-flex' }),
          el('span', { style: 'font-weight:700; font-size:15px; color:var(--md-on-surface)', text: 'Ayrator Boshqaruvi va Holati' })
        ]),
        statusChip(isAeratorOn ? 'healthy' : 'offline', isAeratorOn ? 'ISHLAMOQDA' : 'TO\'XTATILGAN')
      ]),
      
      el('div', { style: 'display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-radius:8px; background:var(--md-surface-container-high); margin-bottom:12px; font-size:12.5px; font-weight:600; color:var(--md-on-surface-variant)' }, [
        el('span', { text: "Hozirgi Rejim:" }),
        el('span', { 
          style: `color:${isManual ? 'var(--md-warning)' : 'var(--md-success)'}; font-weight:700`, 
          text: isManual
            ? `🔧 QO'LDA YOQILGAN${manRemainTxt}`
            : (isVaqtMode ? '🕐 AVTO (vaqt jadvali)' : '🤖 AVTO (kislorod bo\'yicha)')
        })
      ]),

      el('div', { style: 'display:flex; gap:8px; flex-wrap:wrap' }, [
        turnOnBtn,
        autoBtn
      ])
    ], { elevated: true });

    // Beautiful Signal Quality explanation box
    const rssiVal = tel && tel.rssi != null ? Number(tel.rssi) : null;
    let sigText = '';
    let sigLabel = '';
    let sigColor = '';
    let sigIcon = '';
    
    if (rssiVal === null) {
      sigLabel = "Ulanmagan (Offline)";
      sigText = "Qurilma tarmoqqa ulanmagan. So'nggi datchik ma'lumotlari mavjud emas.";
      sigColor = 'var(--md-outline)';
      sigIcon = 'wifi-off';
    } else if (rssiVal >= -60) {
      sigLabel = "A'lo (Excellent)";
      sigText = "Aloqa sifati o'ta barqaror, datchik ma'lumotlari real vaqt rejimida uzluksiz uzatilmoqda.";
      sigColor = 'var(--md-success)';
      sigIcon = 'wifi';
    } else if (rssiVal >= -75) {
      sigLabel = "Yaxshi (Good)";
      sigText = "Aloqa sifati yaxshi, datchik ma'lumotlari muvaffaqiyatli yetib kelmoqda.";
      sigColor = 'var(--md-success)';
      sigIcon = 'wifi';
    } else if (rssiVal >= -85) {
      sigLabel = "O'rtacha (Fair)";
      sigText = "Aloqa sifati o'rtacha. Vaqti-vaqti bilan ma'lumotlar uzatilishida qisqa kechikishlar bo'lishi mumkin.";
      sigColor = 'var(--md-warning)';
      sigIcon = 'wifi';
    } else {
      sigLabel = "Zaif (Poor)";
      sigText = "Aloqa sifati o'ta zaif. Tarmoqdan uzilib qolish xavfi yuqori. Antennani tekshirish yoki ulanish nuqtasiga yaqinroq o'rnatish tavsiya etiladi.";
      sigColor = 'var(--md-critical)';
      sigIcon = 'wifi-off';
    }
    
    const signalExplanationNode = mdCard([
      el('div', { style: 'display:flex; align-items:center; gap:8px; margin-bottom:8px' }, [
        el('span', { html: icon(sigIcon, 18), style: `color:${sigColor}; display:inline-flex` }),
        el('span', { style: 'font-weight:700; font-size:14px; color:var(--md-on-surface)', text: `Aloqa Sifati: ${sigLabel}` })
      ]),
      el('p', { style: 'font-size:12px; line-height:1.4; color:var(--md-on-surface-variant); margin:0', text: `${sigText} (${rssiVal !== null ? 'Hozirgi RSSI kuchi: ' + rssiVal + ' dBm' : 'Signal kuchi mavjud emas'})` })
    ], { elevated: true });

    const stackItems = [header, sensors, thresholdsCard, aeratorControlCard, signalExplanationNode, cmdPanel, info, history];

    mount(content, el('div', { class: 'stack' }, stackItems));
  }

  // Boshlang'ich yuklash
  loadRangeData('24h');

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = () => { unsub(); pageAck.cancel(); if (cmdPanel && typeof cmdPanel.__cleanup === 'function') cmdPanel.__cleanup(); };
  return root;
}

export default renderDeviceDetailPage;
