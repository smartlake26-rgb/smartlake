// ============================================================
//  features/lakes/views/lakeDetailPage.js — Ko'l sahifasi v3 (DS-A)
//  4 TAB: Joriy holat / Tarix / AI tavsiya / Sozlamalar.
//  Joriy holat: salomatlik (baho bilan), suv parametrlari (me'yor+
//  holat+trend), 24h DO grafigi (min/o'rta/maks), aerator boshqaruvi
//  (qurilma tasdig'i bilan), aloqa sifati, ob-havo, yem tavsiya joyi.
//  Tarix: mavjud interaktiv grafik (davrlar bilan) — SAQLANGAN.
//  AI: mavjud aiAdvisorCard — SAQLANGAN (D-bosqichda kengayadi).
//  Sozlamalar: qurilmalar biriktirish/ajratish + ko'l amallari —
//  SAQLANGAN (C-bosqichda pasport qo'shiladi).
//  Firmware/Firebase sinxroniga TEGILMAGAN — faqat ilova qatlami.
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
import { presence } from '../../telemetry/domain/freshness.js';
import { buildHistoryTab } from '../../telemetry/views/historyTab.js';
import { buildLakeSettingsTab } from './lakeSettingsTab.js';
import { buildAiTab } from '../../ai/views/aiTab.js';
import { computeFeedPlan } from '../../telemetry/domain/feedEngine.js';
import { loadLakeMeta } from '../../telemetry/services/archiveService.js';
import { commandService } from '../../commands/services/commandService.js';
import { createAckTracker } from '../../commands/domain/ackTracker.js';
import { COMMAND_TYPES } from '../../../core/collections.js';

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

/** 100-ballik baho -> so'z (DS-A: topshiriq bo'yicha). */
function healthGrade(sc, isUz) {
  if (sc >= 90) return isUz ? "A'lo" : 'Отлично';
  if (sc >= 75) return isUz ? 'Yaxshi' : 'Хорошо';
  if (sc >= 60) return isUz ? 'Ogohlantirish' : 'Внимание';
  return isUz ? 'Kritik' : 'Критично';
}

/** RSSI -> sifat yorlig'i. */
function rssiQuality(v, isUz) {
  if (v == null) return { label: '—', color: 'var(--md-neutral)' };
  if (v >= -60) return { label: isUz ? "A'lo" : 'Отлично', color: 'var(--md-success)' };
  if (v >= -80) return { label: isUz ? 'Yaxshi' : 'Хорошо', color: 'var(--md-success)' };
  if (v >= -100) return { label: isUz ? "O'rtacha" : 'Средне', color: 'var(--md-warning)' };
  return { label: isUz ? 'Zaif' : 'Слабый', color: 'var(--md-critical)' };
}

/** Oxirgi aloqa vaqti formati. */
function fmtAgo(ts, isUz) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return isUz ? 'hozirgina' : 'только что';
  if (m < 60) return `${m} ${isUz ? 'daq oldin' : 'мин назад'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${isUz ? 'soat oldin' : 'ч назад'}`;
  return `${Math.floor(h / 24)} ${isUz ? 'kun oldin' : 'дн назад'}`;
}

/** Trend: oxirgi 3 nuqta vs avvalgi 3 nuqta o'rtachasi. */
function calcTrend(pts, key) {
  const vals = pts.map((x) => x[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vals.length < 4) return null;
  const last = vals.slice(-3), prev = vals.slice(-6, -3).length ? vals.slice(-6, -3) : vals.slice(0, -3);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = avg(last) - avg(prev);
  if (Math.abs(d) < 0.05) return { dir: 0, d };
  return { dir: d > 0 ? 1 : -1, d };
}

export function renderLakeDetailPage(nav, lakeId) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title', text: t('lake.detail') });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [
      mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }),
      el('div', { class: 'grow' }, [titleEl]),
      mdIconButton({ icon: 'settings', onClick: () => { const st = dataStore.getState(); const lk = st.lakes.find((l) => l.id === lakeId) || st.archivedLakes.find((l) => l.id === lakeId); if (lk) nav.push((n) => renderLakeFormPage(n, lk)); } }),
    ]),
    content,
  ]);

  const isUz = detectLocale() === 'uz';

  // --- TAB TIZIMI (DS-A) ---
  let activeTab = 'holat';
  const TAB_DEFS = [
    ['holat', isUz ? 'Joriy holat' : 'Текущее', 'activity'],
    ['tarix', isUz ? 'Tarix' : 'История', 'chip'],
    ['ai', isUz ? 'AI tavsiya' : 'AI совет', 'sun'],
    ['sozlama', isUz ? 'Sozlamalar' : 'Настройки', 'settings'],
  ];
  const tabBtns = new Map();
  const tabBar = el('div', { class: 'md-tabs' }, TAB_DEFS.map(([id, label, ic]) => {
    const b = el('button', { class: 'md-tab' + (id === activeTab ? ' active' : ''),
      html: icon(ic, 15) + `<span>${label}</span>` });
    b.addEventListener('click', () => { if (activeTab !== id) { activeTab = id; render(); } });
    tabBtns.set(id, b);
    return b;
  }));
  root.insertBefore(tabBar, content);

  // --- AERATOR: tanlangan qurilma + qurilma tasdig'i (ackTracker) ---
  let selectedDevId = null;
  const pageAck = createAckTracker((state) => {
    if (state === 'waiting') toast(t('cmd.waitAck'), 'info');
    if (state === 'saved') toast(t('cmd.savedOk'), 'ok');
    if (state === 'timeout') toast(t('cmd.ackTimeout'), 'err');
    if (state === 'rejected') toast(t('cmd.ackRejected'), 'err');
  });
  let aerBusy = false;
  async function sendAer(type) {
    if (!selectedDevId || aerBusy) return;
    aerBusy = true;
    try {
      await commandService.createCommand({ deviceId: selectedDevId, commandType: type, payload: null }, s.uid);
      pageAck.expect(type);
    } catch (e) { toast(t(handleError(e, 'aerator').messageKey), 'err'); }
    finally { aerBusy = false; }
  }

  // --- TARIX tabi (B-bosqich): bir marta, birinchi ochilishda quriladi ---
  let historyTabNode = null;
  function getHistoryTabNode() {
    if (!historyTabNode) {
      historyTabNode = buildHistoryTab({
        lakeId, uid: s.uid, isUz,
        getDevs: () => dataStore.getState().devices.filter((d) => d.lakeId === lakeId),
        getTh: () => {
          const st2 = dataStore.getState();
          const lk = st2.lakes.find((l) => l.id === lakeId) || st2.archivedLakes.find((l) => l.id === lakeId);
          return resolveThresholds(lk);
        },
      });
    }
    return historyTabNode;
  }

  // --- LAKE META (C-bosqich: pasport/baliq/yem/aeratorlar) ---
  let lakeMeta = null;
  loadLakeMeta(lakeId).then((m) => { lakeMeta = m; render(); }).catch(() => {});

  // --- AI TAVSIYA tabi (D-bosqich): bir marta quriladi ---
  let aiTabNode = null;
  function getAiTabNode() {
    if (!aiTabNode) {
      aiTabNode = buildAiTab({
        isUz,
        getParams: () => {
          const st2 = dataStore.getState();
          const lk = st2.lakes.find((l) => l.id === lakeId) || st2.archivedLakes.find((l) => l.id === lakeId) || { id: lakeId, name: '' };
          const devs2 = st2.devices.filter((d) => d.lakeId === lakeId);
          return { lake: lk, devs: devs2, telemetry: st2.telemetry, th: resolveThresholds(lk), meta: lakeMeta, uid: s.uid, weather: weatherData };
        },
        onGoTab: (tabId) => { activeTab = tabId; render(); },
      });
    }
    return aiTabNode;
  }

  // --- SOZLAMALAR tabi (C-bosqich): bir marta quriladi ---
  let settingsTabNode = null;
  function getSettingsTabNode() {
    if (!settingsTabNode) {
      settingsTabNode = buildLakeSettingsTab({
        lakeId, uid: s.uid, isUz,
        onSaved: (m) => { lakeMeta = m; render(); },
      });
    }
    return settingsTabNode;
  }

  // --- 24h TREND/DO-grafik keshi (Joriy holat uchun) ---
  let trendPts = [];
  let trendKey = '';
  function loadTrend(devs) {
    const firstId = devs.length ? devs[0].id : null;
    const key = firstId || 'none';
    if (key === trendKey) return;
    trendKey = key;
    trendPts = [];
    if (!firstId) return;
    historyService.getHistory(firstId, '24h')
      .then((pts) => { trendPts = pts || []; render(); })
      .catch(() => {});
  }

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
      return el('div', { style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--md-on-surface-variant); min-height:180px; width:100%' }, [
        el('div', { style: 'color:var(--md-outline); opacity:0.6; display:flex; justify-content:center; margin-bottom:4px;', html: icon('activity', 36) }),
        el('span', { style: 'font-size:13px; font-weight:600; color:var(--md-on-surface)', text: t('common.noData') }),
        el('span', { style: 'font-size:11px; text-align:center; max-width:260px; opacity:0.7; color:var(--md-on-surface-variant)', text: 'Tanlangan vaqt oralig\'ida ko\'lga bog\'langan qurilmalardan olingan o\'lchov ma\'lumotlari mavjud emas.' })
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
      el('div', { class: 'sk', style: 'width:22px;height:22px;border-radius:50%' }),
      el('span', { style: 'font-size:11px; color:var(--md-on-surface-variant)', text: t('app.loading') })
    ]));

    statsEl.replaceChildren();

    try {
      const st = dataStore.getState();
      const currentDevs = st.devices.filter((d) => d.lakeId === lakeId);
      
      if (!currentDevs.length) {
        mount(chartContainer, el('div', { style: 'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--md-on-surface-variant); min-height:180px; width:100%' }, [
          el('div', { style: 'color:var(--md-outline); opacity:0.6; display:flex; justify-content:center; margin-bottom:4px;', html: icon('chip', 36) }),
          el('span', { style: 'font-size:13px; font-weight:600; color:var(--md-on-surface)', text: t('lake.noDevices') }),
          el('span', { style: 'font-size:11px; text-align:center; max-width:260px; opacity:0.7; color:var(--md-on-surface-variant)', text: 'Bu ko\'lga birorta ham qurilma biriktirilmagan.' })
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
            el('div', { style: 'color:var(--md-on-surface-variant); font-size:11px' }, [
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
      mount(chartContainer, el('div', { class: 'md-banner warn', text: t(handleError(e, 'history').messageKey) }));
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

  const historyCard = el('div', { class: 'md-card' }, [
    el('div', { style: 'font-weight:700; margin-bottom:4px; display:flex; align-items:center; gap:6px' }, [
      el('span', { html: icon('activity', 18), style: 'display:inline-flex; color:var(--md-primary); vertical-align:middle' }),
      el('span', { text: t('tm.history') })
    ]),
    el('div', { style: 'font-size:11px; color:var(--md-on-surface-variant); margin-bottom:8px', text: t('tm.historyHint') }),
    el('div', { style: 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px' }, rangeButtons),
    chartContainer,
    statsEl
  ]);

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const lake = st.lakes.find((l) => l.id === lakeId) || st.archivedLakes.find((l) => l.id === lakeId);
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

    // DS-A: 24h trend ma'lumoti + aerator uchun tanlangan qurilma + tasdiq
    loadTrend(devs);
    if (!selectedDevId || !devs.some((d) => d.id === selectedDevId)) {
      selectedDevId = devs.length ? devs[0].id : null;
    }
    pageAck.feed(selectedDevId ? st.telemetry.get(selectedDevId) : null);

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
      el('div', { style: 'text-align:center;margin-top:2px' }, [
        el('span', { class: 't-title-sm', style: `color:${healthColor(a.healthScore)};font-weight:800;letter-spacing:.02em`,
          text: healthGrade(a.healthScore, isUz) }),
      ]),
      el('div', { class: 't-body-sm muted', style: 'text-align:center;margin-top:2px', text: `${a.online}/${a.deviceCount} ${t('tm.online')}` }),
    ], { elevated: true, cls: a.healthScore <= 60 ? 'bento-cell-critical' : '' });

    // DS-A: SUV PARAMETRLARI — qiymat + me'yor + holat + trend
    const evalDo = (v) => v == null ? 'unknown' : v < th.do.crit ? 'critical' : v < th.do.warn ? 'warning' : 'healthy';
    const evalTemp = (v) => v == null ? 'unknown' : (v < th.temp.critMin || v > th.temp.critMax) ? 'critical'
      : (v < th.temp.warnMin || v > th.temp.warnMax) ? 'warning' : 'healthy';
    const evalPh = (v) => v == null ? 'unknown' : (v < th.ph.critMin || v > th.ph.critMax) ? 'critical'
      : (v < th.ph.warnMin || v > th.ph.warnMax) ? 'warning' : 'healthy';
    const stColor = (x) => x === 'healthy' ? 'var(--md-success)' : x === 'warning' ? 'var(--md-warning)'
      : x === 'critical' ? 'var(--md-critical)' : 'var(--md-neutral)';
    const trendBadge = (tr) => {
      if (!tr) return el('span', { class: 't-caption', text: '' });
      const up = tr.dir > 0, flat = tr.dir === 0;
      const col = flat ? 'var(--md-neutral)' : up ? 'var(--md-success)' : 'var(--md-warning)';
      return el('span', { style: `font-size:11px;font-weight:800;color:${col}`,
        text: flat ? (isUz ? '— barqaror' : '— стабильно') : (up ? '▲' : '▼') + ` ${Math.abs(tr.d).toFixed(1)}` });
    };
    const paramCard = ({ label, ic, value, unit, color, norm, stKey, tr }) => el('div', {
      class: 'sensor-card',
      style: `text-align:left;border-color:color-mix(in srgb, ${color} 20%, var(--md-outline-variant))`,
    }, [
      el('div', { class: 'row-between' }, [
        el('span', { class: 'sc-lab', style: 'display:flex;align-items:center;gap:5px' }, [
          el('span', { html: icon(ic, 13), style: `color:${color};display:inline-flex` }),
          el('span', { text: label }),
        ]),
        el('span', { style: `width:8px;height:8px;border-radius:50%;background:${stColor(stKey)};box-shadow:0 0 5px ${stColor(stKey)}` }),
      ]),
      el('div', { class: 't-num-md', style: `color:${color};margin-top:6px`, text: value != null ? `${value}` : '—' }),
      el('div', { class: 't-caption', style: 'margin-top:2px', text: `${unit ? unit + ' · ' : ''}${isUz ? "me'yor" : 'норма'}: ${norm}` }),
      el('div', { style: 'margin-top:5px' }, [trendBadge(tr)]),
    ]);
    const sensors = el('div', { class: 'sensor-grid' }, [
      paramCard({ label: 'Kislorod (DO)', ic: 'waves', value: a.avgDo, unit: 'mg/L', color: 'var(--chart-do)',
        norm: `≥${th.do.warn}`, stKey: evalDo(a.avgDo), tr: calcTrend(trendPts, 'do') }),
      paramCard({ label: t('tm.temp'), ic: 'thermometer', value: a.avgTemp, unit: '°C', color: 'var(--chart-temp)',
        norm: `${th.temp.warnMin}–${th.temp.warnMax}`, stKey: evalTemp(a.avgTemp), tr: calcTrend(trendPts, 't') }),
      paramCard({ label: 'pH', ic: 'activity', value: a.avgPh, unit: '', color: 'var(--chart-ph)',
        norm: `${th.ph.warnMin}–${th.ph.warnMax}`, stKey: evalPh(a.avgPh), tr: calcTrend(trendPts, 'ph') }),
      paramCard({ label: isUz ? 'Batareya' : 'Батарея', ic: 'battery', value: (() => {
          const b = devs.map((d) => (st.telemetry.get(d.id) || {}).battery).filter((v) => v != null);
          return b.length ? Math.round(b.reduce((x, y) => x + y, 0) / b.length) : null;
        })(), unit: '%', color: 'var(--md-secondary)', norm: `≥${th.battery.warn}%`,
        stKey: 'healthy', tr: null }),
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
    } else {
      actions.push(mdButton({ label: t('lake.restore'), variant: 'filled', full: true, onClick: () => {
        openDialog({ title: t('lake.restore') + '?', body: t('lake.restoreConfirm'), actions: [
          { label: t('common.cancel'), variant: 'text' },
          { label: t('lake.restore'), variant: 'filled', onClick: async () => {
            try { await lakeService.setStatus(lake.id, LAKE_STATUS.ACTIVE, s.uid); await dataStore.refresh(); toast(t('lake.restored'), 'ok'); nav.back(); }
            catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
          } }
        ] });
      } }));
    }

    // Beautiful dedicated Weather Card
    let weatherCardNode = null;
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

    // ================= DS-A: JORIY HOLAT bloklari =================

    // --- 24h KISLOROD grafigi (min/o'rta/maks bilan) ---
    const doVals = trendPts.map((x) => x.do).filter((v) => typeof v === 'number' && Number.isFinite(v));
    let doMiniCard = null;
    {
      let body;
      if (doVals.length >= 2) {
        const w = 560, h = 120, minV = Math.min(...doVals), maxV = Math.max(...doVals);
        const span = (maxV - minV) || 1;
        const xs = trendPts.filter((x) => typeof x.do === 'number');
        const coord = xs.map((pt, i) => [ (i / (xs.length - 1)) * w, h - 12 - ((pt.do - minV) / span) * (h - 28) ]);
        const line = coord.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const area = `M ${coord[0][0].toFixed(1)} ${h} ` + coord.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ` L ${coord[coord.length-1][0].toFixed(1)} ${h} Z`;
        const warnY = h - 12 - ((th.do.warn - minV) / span) * (h - 28);
        const thLine = (th.do.warn >= minV && th.do.warn <= maxV)
          ? `<line x1="0" y1="${warnY.toFixed(1)}" x2="${w}" y2="${warnY.toFixed(1)}" class="chart-threshold" stroke="var(--md-warning)"/>` : '';
        body = el('div', { html: `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
          <defs><linearGradient id="doarea-${lakeId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-do)" stop-opacity=".2"/>
            <stop offset="100%" stop-color="var(--chart-do)" stop-opacity="0"/></linearGradient></defs>
          <path d="${area}" fill="url(#doarea-${lakeId})"/>${thLine}
          <polyline points="${line}" fill="none" stroke="var(--chart-do)" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round"/></svg>` });
      } else {
        body = el('div', { class: 't-body-sm muted', style: 'text-align:center;padding:22px 0',
          text: isUz ? "Ma'lumot to'planmoqda..." : 'Данные накапливаются...' });
      }
      const stat = (lab, v, col) => el('div', { style: 'flex:1;text-align:center;padding:8px;border-radius:var(--shape-sm);background:var(--md-surface-container-low)' }, [
        el('div', { class: 't-caption', text: lab }),
        el('div', { class: 't-num-md', style: `font-size:17px;color:${col}`, text: v != null ? v.toFixed(1) : '—' }),
      ]);
      const avg = doVals.length ? doVals.reduce((x, y) => x + y, 0) / doVals.length : null;
      doMiniCard = mdCard([
        el('div', { class: 'row-between', style: 'margin-bottom:6px' }, [
          el('span', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px' }, [
            el('span', { html: icon('waves', 16), style: 'color:var(--chart-do);display:inline-flex' }),
            el('span', { text: isUz ? 'Kislorod — oxirgi 24 soat' : 'Кислород — за 24 часа' }),
          ]),
        ]),
        body,
        el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
          stat(isUz ? 'Minimum' : 'Минимум', doVals.length ? Math.min(...doVals) : null, 'var(--md-critical)'),
          stat(isUz ? "O'rtacha" : 'Среднее', avg, 'var(--chart-do)'),
          stat(isUz ? 'Maksimum' : 'Максимум', doVals.length ? Math.max(...doVals) : null, 'var(--md-success)'),
        ]),
      ]);
    }

    // --- AERATOR BOSHQARUVI (qurilma tasdig'i bilan) ---
    const selTel = selectedDevId ? st.telemetry.get(selectedDevId) : null;
    const selOnline = selTel ? presence(selTel.ts) === 'online' : false;
    const isManual = selTel && selTel.manual === 1;
    const aerOn = selTel && selTel.aer === 1;
    const devChips = devs.length > 1 ? el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px' },
      devs.map((d) => {
        const b = el('button', { class: 'md-tab' + (d.id === selectedDevId ? ' active' : ''),
          style: 'flex:none;padding:6px 12px;font-size:11px', text: d.id.slice(-4) });
        b.addEventListener('click', () => { selectedDevId = d.id; render(); });
        return b;
      })) : null;
    const aerRow = (lab, val) => el('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant);font-size:12.5px' }, [
      el('span', { class: 'muted', text: lab }),
      el('span', { style: 'font-weight:700;font-variant-numeric:tabular-nums', text: val }),
    ]);
    const btnAuto = mdButton({ label: 'AUTO', icon: 'activity', variant: (!isManual && selOnline) ? 'filled' : 'outlined',
      onClick: () => sendAer(COMMAND_TYPES.AERATOR_OFF) });
    const btnOn = mdButton({ label: isUz ? 'Majburiy YOQISH' : 'Принуд. ВКЛ', icon: 'power', variant: isManual ? 'filled' : 'tonal',
      onClick: () => sendAer(COMMAND_TYPES.AERATOR_ON) });
    const btnOff = mdButton({ label: isUz ? "Majburiy O'CHIRISH" : 'Принуд. ВЫКЛ', icon: 'power', variant: 'outlined', onClick: () => {} });
    btnOff.disabled = true;
    if (!selectedDevId || !selOnline) { btnAuto.disabled = true; btnOn.disabled = true; }
    const aeratorCard = mdCard([
      el('div', { class: 'row-between', style: 'margin-bottom:8px' }, [
        el('span', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { html: icon('power', 16), style: 'color:var(--md-primary);display:inline-flex' }),
          el('span', { text: isUz ? 'Aerator boshqaruvi' : 'Управление аэратором' }),
        ]),
        statusChip(aerOn ? 'healthy' : 'offline', aerOn ? (isUz ? 'ISHLAMOQDA' : 'РАБОТАЕТ') : (isUz ? "TO'XTATILGAN" : 'ОСТАНОВЛЕН')),
      ]),
      devChips,
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px' }, [btnAuto, btnOn, btnOff]),
      el('div', { class: 't-caption', style: 'margin-bottom:8px', text: isUz
        ? "Majburiy o'chirish qurilmada yo'q — AUTO rejimda kislorod yetarli bo'lsa qurilma o'zi o'chiradi (baliq himoyasi)."
        : 'Принудительного ВЫКЛ в устройстве нет — в AUTO устройство отключает само при достатке кислорода.' }),
      aerRow(isUz ? 'Hozirgi rejim' : 'Режим', isManual
        ? (isUz ? "QO'LDA" : 'РУЧНОЙ') + (selTel && selTel.man_remain > 0 ? ` (${selTel.man_remain} ${isUz ? 'daq' : 'мин'})` : '')
        : (selTel && selTel.mode === 1 ? (isUz ? 'AVTO (vaqt)' : 'АВТО (время)') : (isUz ? 'AVTO (kislorod)' : 'АВТО (кислород)'))),
      aerRow(isUz ? 'Oxirgi buyruq' : 'Последняя команда', selTel && selTel.last_cmd_ts ? fmtAgo(selTel.last_cmd_ts, isUz) : '—'),
      aerRow(isUz ? 'Bugun ishlagan vaqti' : 'Наработка сегодня', '—'),
      aerRow(isUz ? 'Bugungi elektr sarfi' : 'Расход эл-ва сегодня', '—'),
      el('div', { class: 't-caption', style: 'margin-top:6px', text: isUz
        ? "Ish vaqti va elektr hisobi Tarix bosqichi (B) bilan yoqiladi."
        : 'Наработка и расход включатся на этапе Истории (B).' }),
    ]);

    // --- ALOQA SIFATI ---
    const connCard = mdCard([
      el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
        el('span', { html: icon('wifi', 16), style: 'color:var(--md-primary);display:inline-flex' }),
        el('span', { text: isUz ? 'Aloqa sifati' : 'Качество связи' }),
      ]),
      ...(devs.length ? devs.map((d) => {
        const tel = st.telemetry.get(d.id) || null;
        const pres = tel ? presence(tel.ts) : 'offline';
        const q = rssiQuality(tel && tel.rssi != null ? Number(tel.rssi) : null, isUz);
        return el('div', { class: 'row-between', style: 'padding:8px 0;border-bottom:1px solid var(--md-outline-variant)' }, [
          el('div', {}, [
            el('div', { class: 't-mono', style: 'font-size:12.5px;font-weight:700', text: d.id }),
            el('div', { class: 't-caption', text: `${isUz ? 'Oxirgi aloqa' : 'Связь'}: ${fmtAgo(tel && tel.ts, isUz)}`
              + (tel && tel.battery != null ? ` · ${isUz ? 'Batareya' : 'Батарея'} ${tel.battery}%` : '') }),
          ]),
          el('div', { style: 'text-align:right' }, [
            statusChip(pres === 'online' ? 'healthy' : 'offline', pres === 'online' ? 'Online' : 'Offline'),
            el('div', { class: 't-caption', style: `margin-top:3px;color:${q.color};font-weight:700;font-variant-numeric:tabular-nums`,
              text: tel && tel.rssi != null ? `RSSI ${tel.rssi} dBm · ${q.label}` : 'RSSI —' }),
          ]),
        ]);
      }) : [el('div', { class: 't-body-sm muted', text: t('lake.noDevices') })]),
    ]);

    // --- YEM TAVSIYASI (C-bosqich: feedEngine + lakeMeta) ---
    const feedPlan = lakeMeta ? computeFeedPlan({ fish: lakeMeta.fish || [], feed: lakeMeta.feed || {}, tempC: a.avgTemp, weather: weatherData }) : null;
    let feedBody;
    if (feedPlan) {
      const fr = (lab, val, col = 'var(--md-on-surface)') => el('div', { class: 'row-between', style: 'padding:5px 0;border-bottom:1px solid var(--md-outline-variant);font-size:12.5px' }, [
        el('span', { class: 'muted', text: lab }),
        el('span', { style: `font-weight:800;font-variant-numeric:tabular-nums;color:${col}`, text: val }),
      ]);
      feedBody = el('div', {}, [
        el('div', { style: 'display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap' }, feedPlan.meals.map((m) =>
          el('div', { style: 'flex:1;text-align:center;padding:8px 4px;border-radius:var(--shape-sm);background:color-mix(in srgb, var(--md-tertiary) 8%, var(--md-surface-container-lowest));border:1px solid color-mix(in srgb, var(--md-tertiary) 18%, var(--md-outline-variant))' }, [
            el('div', { class: 't-caption', style: 'font-weight:700', text: m.time }),
            el('div', { style: 'font-weight:800;font-size:15px;color:var(--md-tertiary);font-variant-numeric:tabular-nums', text: `${m.kg.toFixed(1)} kg` }),
          ]))),
        ...(feedPlan.notes || []).map((n) => el('div', { class: 't-caption', style: 'color:var(--md-warning);font-weight:700;margin-bottom:4px', text: '⚠ ' + n.text })),
        fr(isUz ? 'Biomassa' : 'Биомасса', `${feedPlan.biomass.toFixed(0)} kg`),
        fr(isUz ? `Stavka (${a.avgTemp != null ? a.avgTemp + '°C' : '—'})` : `Ставка (${a.avgTemp != null ? a.avgTemp + '°C' : '—'})`, `${feedPlan.ratePct}% / ${isUz ? 'kun' : 'день'}`),
        fr(isUz ? 'Bugun jami' : 'Всего сегодня', `${feedPlan.dailyKg.toFixed(1)} kg`, 'var(--md-tertiary)'),
        fr(isUz ? 'Taxminiy narxi' : 'Стоимость', feedPlan.dailyCost != null ? `${Math.round(feedPlan.dailyCost).toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '—', 'var(--md-primary)'),
        el('div', { class: 't-caption', style: 'margin-top:5px', text: isUz
          ? "Stavkalar professional yem jadvali (harorat × baliq vazni) asosida; issiqda mahallar ko'payadi, bulutli kunda 50% kamayadi."
          : 'Ставки по проф. таблице (темп. × вес рыбы); в жару больше кормлений, в пасмурно −50%.' }),
      ]);
    } else {
      feedBody = el('div', {}, [
        el('div', { class: 't-body-sm muted', text: isUz
          ? "Aniq hisob uchun Sozlamalar tabida baliq turi, soni va vaznini kiriting — tizim soat, kg va narxni avtomatik hisoblaydi."
          : 'Для расчёта укажите в Настройках вид, количество и вес рыбы.' }),
        el('div', { style: 'margin-top:10px' }, [
          mdButton({ label: isUz ? 'Sozlamalarga o\'tish' : 'К настройкам', variant: 'tonal',
            onClick: () => { activeTab = 'sozlama'; render(); } }),
        ]),
      ]);
    }
    const feedCard = mdCard([
      el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:8px' }, [
        el('span', { html: icon('droplet', 16), style: 'color:var(--md-tertiary);display:inline-flex' }),
        el('span', { text: isUz ? 'Yem tavsiyasi' : 'Рекомендация корма' }),
      ]),
      feedBody,
    ]);

    // ================= TAB KOMPOZITSIYASI =================
    tabBtns.forEach((b, id) => b.classList.toggle('active', id === activeTab));
    let components;
    if (activeTab === 'tarix') components = [historyCard, getHistoryTabNode()];
    else if (activeTab === 'ai') components = [getAiTabNode()];
    else if (activeTab === 'sozlama') components = [getSettingsTabNode(), devicesCard, ...actions];
    else {
      components = [header, sensors, doMiniCard, aeratorCard, connCard];
      if (weatherCardNode) components.push(weatherCardNode);
      components.push(feedCard);
    }
    mount(content, el('div', { class: 'stack anim-up' }, components));
  }

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = () => { unsub(); pageAck.cancel(); };
  return root;
}

export default renderLakeDetailPage;
