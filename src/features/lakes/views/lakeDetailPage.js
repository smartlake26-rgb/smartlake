// ============================================================
//  features/lakes/views/lakeDetailPage.js — Ko'l tafsilotlari
//  Gauge + sensor kartalari + qurilmalar (biriktirish/ajratish) +
//  amallar (tahrirlash, faol/nofaol, arxivlash). Realtime.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import {
  appBar, mdIconButton, mdCard, mdButton, statusChip, sensorCard, listItem,
  select, emptyState, openDialog, skeletonCards,
} from '../../../shared/ui/index.js';
import { gauge } from '../../../shared/ui/gauge.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { authStore } from '../../auth/index.js';
import { lakeService, deviceAssignmentService } from '../index.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { renderDeviceDetailPage } from '../../telemetry/views/deviceDetailPage.js';
import { aiAdvisorCard } from '../../telemetry/components/aiAdvisorCard.js';
import { getLakeWeather, getWeatherIcon } from '../../telemetry/services/weatherService.js';
import { detectLocale } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { historyService, RANGES } from '../../telemetry/services/historyService.js';

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

function healthColor(s) { return s >= 90 ? 'var(--md-success)' : s >= 60 ? 'var(--md-warning)' : 'var(--md-critical)'; }

export function renderLakeDetailPage(nav, lakeId) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title', text: t('lake.detail') });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [
      mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }),
      el('div', { class: 'grow' }, [titleEl]),
      mdIconButton({ icon: 'settings', onClick: () => { const lk = dataStore.getState().lakes.find((l) => l.id === lakeId); if (lk) nav.push((n) => renderLakeFormPage(n, lk)); } }),
    ]),
    content,
  ]);

  let weatherData = null;
  let weatherLoading = false;

  function loadWeather(lake) {
    if (weatherData || weatherLoading) return;
    weatherLoading = true;
    const locale = detectLocale();
    getLakeWeather(lake, locale)
      .then((data) => {
        weatherData = data;
        render();
      })
      .catch(() => {
        weatherLoading = false;
      });
  }

  // --- Tarixiy ma'lumotlar tahlili va interaktiv SVG grafik ---
  const chartContainer = el('div', { style: 'min-height:220px; display:flex; align-items:center; justify-content:center; position:relative; background:var(--md-surface-container-low, #f0f4f8); border-radius:12px; border:1px solid var(--md-outline-variant, #e0e0e0); padding:12px; margin-top:8px; overflow:hidden' });
  const statsEl = el('div', { style: 'margin-top:12px; display:flex; flex-direction:column; gap:8px' });
  let activeRange = '24h';
  let lastDeviceIdsStr = 'NOT_LOADED_YET';

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
        el('span', { style: 'font-size:11px; text-align:center; max-width:260px; opacity:0.7; color:var(--ink-soft)', text: 'Tanlangan vaqt oralig\'ida ko\'lga bog\'langan qurilmalardan olingan o\'lchov ma\'lumotlari mavjud emas.' })
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
      const st = dataStore.getState();
      const currentDevs = st.devices.filter((d) => d.lakeId === lakeId);
      
      if (!currentDevs.length) {
        mount(chartContainer, el('div', { style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--ink-soft); min-height:180px; width:100%' }, [
          el('div', { style: 'color:var(--md-outline); opacity:0.6; display:flex; justify-content:center; margin-bottom:4px;', html: icon('chip', 36) }),
          el('span', { style: 'font-size:13px; font-weight:600; color:var(--md-on-surface)', text: t('lake.noDevices') }),
          el('span', { style: 'font-size:11px; text-align:center; max-width:260px; opacity:0.7; color:var(--ink-soft)', text: 'Bu ko\'lga birorta ham qurilma biriktirilmagan.' })
        ]));
        return;
      }

      const histories = await Promise.all(
        currentDevs.map(d => historyService.getHistory(d.id, rk).catch(() => []))
      );

      const points = [];
      histories.forEach(pts => {
        points.push(...pts);
      });
      points.sort((a, b) => {
        const tA = (a.ts && a.ts.toMillis) ? a.ts.toMillis() : (typeof a.ts === 'number' ? a.ts : Number(a.ts));
        const tB = (b.ts && b.ts.toMillis) ? b.ts.toMillis() : (typeof b.ts === 'number' ? b.ts : Number(b.ts));
        return tA - tB;
      });

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
      style: 'background:transparent; color:var(--md-primary, #00639b); border-radius:20px; border:1px solid var(--md-outline-variant, #c4c7c5); padding:6px 12px; cursor:pointer; font-size:11px; font-weight:600; transition:all 0.2s; outline:none',
      text: t('tm.range_' + rk)
    });
    b.addEventListener('click', () => loadRangeData(rk));
    rangeButtonsEls.set(rk, b);
    return b;
  });

  const historyCard = el('div', { class: 'card', style: 'padding:14px' }, [
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
    const lake = st.lakes.find((l) => l.id === lakeId);
    if (!lake) { mount(content, emptyState({ icon: 'droplet', title: t('error.lakeNotFound') })); return; }
    
    // Trigger non-blocking weather load
    loadWeather(lake);

    titleEl.textContent = lake.name;
    const th = resolveThresholds(lake);
    const devs = st.devices.filter((d) => d.lakeId === lake.id);

    // Re-load range data reactively when devices list changes
    const deviceIdsStr = devs.map(d => d.id).sort().join(',');
    if (deviceIdsStr !== lastDeviceIdsStr) {
      lastDeviceIdsStr = deviceIdsStr;
      loadRangeData(activeRange);
    }

    const a = aggregateLake(devs, st.telemetry, th);
    const assignable = st.devices.filter((d) => !d.lakeId);

    // Header: status + health gauge
    const header = mdCard([
      el('div', { class: 'row-between' }, [
        el('div', {}, [
          el('div', { class: 't-headline', text: lake.name }),
          el('div', { class: 't-body-sm muted', text: `${lake.district || ''} ${lake.region || ''}` }),
        ]),
        statusChip(lake.status === LAKE_STATUS.INACTIVE ? 'offline' : a.status,
          lake.status === LAKE_STATUS.INACTIVE ? t('lake.status_inactive') : t('tm.status_' + a.status)),
      ]),
      el('div', { style: 'display:flex;justify-content:center;margin-top:8px' }, [
        gauge({ value: a.healthScore, min: 0, max: 100, unit: t('tm.health'), color: healthColor(a.healthScore) }),
      ]),
      el('div', { class: 't-body-sm muted', style: 'text-align:center', text: `${a.online}/${a.deviceCount} ${t('tm.online')}` }),
    ], { elevated: true, cls: a.healthScore <= 60 ? 'bento-cell-critical' : '' });

    // Sensor grid
    const sensors = el('div', { class: 'sensor-grid' }, [
      sensorCard({ label: 'DO', value: a.avgDo, unit: 'mg/L', isLive: a.online > 0 }),
      sensorCard({ label: t('tm.temp'), value: a.avgTemp, unit: '°C', isLive: a.online > 0 }),
      sensorCard({ label: 'pH', value: a.avgPh, isLive: a.online > 0 }),
      sensorCard({ label: t('tm.online'), value: `${a.online}/${a.deviceCount}`, isLive: a.online > 0 }),
    ]);

    // Devices
    const deviceRows = devs.length ? devs.map((d) => listItem({
      leading: 'chip', title: d.id,
      trailing: el('div', { class: 'row', style: 'gap:6px' }, [
        statusChip(deviceStatus(st.telemetry.get(d.id) || null, th), ''),
        mdButton({ label: t('lake.unassign'), variant: 'text', onClick: async (ev) => {
          ev.stopPropagation();
          try { await deviceAssignmentService.unassign(lake.id, d.id, s.uid); await dataStore.refresh(); toast(t('lake.unassigned'), 'ok'); }
          catch (e) { toast(t(handleError(e, 'unassign').messageKey), 'err'); }
        } }),
      ]),
      onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
    })) : [el('div', { class: 't-body-sm muted', style: 'padding:8px 4px', text: t('lake.noDevices') })];

    const assignRow = [];
    if (assignable.length) {
      const sel = select([{ value: '', label: t('lake.selectDevice') }, ...assignable.map((d) => ({ value: d.id, label: d.id }))], '');
      const btn = mdButton({ label: t('lake.assign'), variant: 'tonal', onClick: async () => {
        if (!sel.value) return;
        try { await deviceAssignmentService.assign(lake.id, sel.value, s.uid); await dataStore.refresh(); toast(t('lake.assigned'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'assign').messageKey), 'err'); }
      } });
      assignRow.push(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [el('div', { class: 'grow' }, [sel]), btn]));
    }

    const devicesCard = mdCard([
      el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('lake.attachedDevices') }),
      el('div', { class: 'md-list' }, deviceRows),
      ...assignRow,
    ]);

    // Actions
    const archived = lake.status === LAKE_STATUS.ARCHIVED;
    const actions = [];
    if (!archived) {
      const toggle = lake.status === LAKE_STATUS.ACTIVE ? LAKE_STATUS.INACTIVE : LAKE_STATUS.ACTIVE;
      actions.push(mdButton({ label: t(lake.status === LAKE_STATUS.ACTIVE ? 'lake.deactivate' : 'lake.activate'), variant: 'outlined', full: true, onClick: async () => {
        try { await lakeService.setStatus(lake.id, toggle, s.uid); await dataStore.refresh(); toast(t('common.saved'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
      } }));
      actions.push(mdButton({ label: t('lake.archive'), variant: 'text', full: true, onClick: () => {
        openDialog({ title: t('lake.archive') + '?', body: t('lake.archiveConfirm'), actions: [
          { label: t('common.cancel'), variant: 'text' },
          { label: t('lake.archive'), variant: 'text', onClick: async () => {
            try { await lakeService.archive(lake.id, s.uid); await dataStore.refresh(); toast(t('lake.archived'), 'ok'); nav.back(); }
            catch (e) { toast(t(handleError(e, 'archive').messageKey), 'err'); }
          } },
        ] });
      } }));
    }

    // Beautiful dedicated Weather Card
    let weatherCardNode = null;
    const isUz = detectLocale() === 'uz';
    if (weatherData) {
      const weatherIconName = getWeatherIcon(weatherData.code);
      const tomorrowIconName = getWeatherIcon(weatherData.code); // simple fallback
      
      weatherCardNode = mdCard([
        el('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px' }, [
          el('div', { style: 'display:flex;align-items:center;gap:6px' }, [
            el('span', { html: icon('sun', 16), style: 'color:var(--md-primary);display:inline-flex' }),
            el('span', { class: 't-title-sm', style: 'font-weight:700', text: isUz ? 'Hududiy Ob-havo' : 'Погода региона' })
          ]),
          el('span', {
            class: 't-label',
            style: 'font-size:10px;text-transform:uppercase;padding:2px 8px;border-radius:12px;background:color-mix(in srgb, var(--md-primary) 15%, transparent);color:var(--md-primary);font-weight:800',
            text: weatherData.district
          })
        ]),
        el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, [
          // Today
          el('div', { 
            class: 'bento-cell',
            style: 'padding:10px;border-radius:12px;background:color-mix(in srgb, var(--md-primary) 6%, var(--md-surface-container-high));border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;gap:4px' 
          }, [
            el('span', { class: 't-label muted', text: isUz ? 'Bugun' : 'Сегодня' }),
            el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:2px' }, [
              el('span', { html: icon(weatherIconName, 20), style: 'color:var(--md-primary);display:inline-flex' }),
              el('span', { style: 'font-size:16px;font-weight:800;color:var(--md-on-surface)', text: `${weatherData.temp}°C` })
            ]),
            el('span', { style: 'font-size:11.5px;font-weight:500;color:var(--md-on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: weatherData.label })
          ]),
          // Tomorrow
          el('div', { 
            class: 'bento-cell',
            style: 'padding:10px;border-radius:12px;background:color-mix(in srgb, var(--md-tertiary) 6%, var(--md-surface-container-high));border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;gap:4px' 
          }, [
            el('span', { class: 't-label muted', text: isUz ? 'Ertaga (Bashorat)' : 'Завтра (Прогноз)' }),
            el('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:2px' }, [
              el('span', { html: icon(tomorrowIconName, 20), style: 'color:var(--md-tertiary);display:inline-flex' }),
              el('span', { style: 'font-size:16px;font-weight:800;color:var(--md-on-surface)', text: `${weatherData.tomorrowTempMax}°C` })
            ]),
            el('span', { style: 'font-size:11.5px;font-weight:500;color:var(--md-on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: weatherData.tomorrowLabel })
          ])
        ])
      ], { elevated: true });
    } else if (weatherLoading) {
      weatherCardNode = mdCard([
        el('div', { style: 'display:flex;align-items:center;justify-content:center;height:80px;color:var(--md-on-surface-variant);font-size:13px;font-weight:500' }, [
          el('span', { text: isUz ? "Ob-havo yuklanmoqda..." : "Загрузка погоды..." })
        ])
      ]);
    }

    const advisor = aiAdvisorCard({ lake, devs, telemetry: st.telemetry, weather: weatherData });

    const components = [header, sensors, historyCard];
    if (weatherCardNode) components.push(weatherCardNode);
    components.push(advisor, devicesCard, ...actions);

    mount(content, el('div', { class: 'stack' }, components));
  }

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = unsub;
  return root;
}

export default renderLakeDetailPage;
