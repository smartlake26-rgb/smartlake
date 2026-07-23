// ============================================================
//  features/lakes/views/lakeDetailPage.js — KO'L SAHIFASI v4
//  "Boshqaruv markazi" (LAKEDET-V4, Design System 3.0)
//
//  4 TAB (sticky): Joriy holat / Tarix / AI tavsiya / Sozlamalar
//
//  SAQLANGAN funksiyalar (v3): orqaga/tahrirlash navigatsiyasi,
//  aerator boshqaruvi (commandService + ackTracker, AUTO/YOQISH,
//  qurilmada majburiy O'CHIRISH yo'qligi izohi), yem tavsiyasi
//  (feedEngine + lakeMeta), aloqa sifati, ob-havo, Tarix
//  (buildHistoryTab: filtrlar/jadval/XLSX-CSV-PDF/elektr/yem),
//  AI (buildAiTab), Sozlamalar (buildLakeSettingsTab) + qurilma
//  biriktirish/ajratish + faollashtirish/arxivlash/tiklash.
//
//  YANGI: sticky tab-panel, sahifa-usti qisqa ma'lumot (holat/
//  yangilanish/signal/salomatlik), sensor kartalari (qiymat+
//  me'yor+trend+yangilanish, bosilsa 24h grafik dialogi; TDS va
//  Ammiak uchun UI tayyor), DS slLineChart'da animatsiyali 24h
//  DO grafigi (min/o'rta/maks), Tarix tabidagi eski 500-satrlik
//  inline-hex grafik dvigateli DS chart.js'ga birlashtirildi,
//  aeratorda ish-vaqt/elektr statistikasi (arxivdan, lazy).
//
//  Firmware/Firebase Business Logic'ga TEGILMAGAN — barcha
//  hisoblar mavjud modullar orqali: aggregateLake, deviceStatus,
//  presence, rssiQuality, computeFeedPlan, historyService,
//  fetchArchive, aeratorRuntimeMs, commandService.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import {
  mdIconButton, openDialog, skeletonCards,
} from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { authStore } from '../../auth/index.js';
import { lakeService, deviceAssignmentService } from '../index.js';
import { LAKE_STATUS, COMMAND_TYPES } from '../../../core/collections.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';
import { presence } from '../../telemetry/domain/freshness.js';
import { rssiQuality as rssiQ } from '../../telemetry/domain/signalQuality.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { renderDeviceDetailPage } from '../../telemetry/views/deviceDetailPage.js';
import { getLakeWeather, getWeatherIcon } from '../../telemetry/services/weatherService.js';
import { historyService, RANGES } from '../../telemetry/services/historyService.js';
import { buildHistoryTab } from '../../telemetry/views/historyTab.js';
import { buildLakeSettingsTab } from './lakeSettingsTab.js';
import { buildAiTab } from '../../ai/views/aiTab.js';
import { computeFeedPlan } from '../../telemetry/domain/feedEngine.js';
import {
  loadLakeMeta, fetchArchive, aeratorRuntimeMs,
} from '../../telemetry/services/archiveService.js';
import { commandService } from '../../commands/services/commandService.js';
import { createAckTracker } from '../../commands/domain/ackTracker.js';
import {
  slIcon, ICONS, slCard, slButton, slBadge, slStatusBadge, slListItem,
  slSelect, slEmptyState, slKvRow, slLineChart, slChartLegend,
  slGaugeChart, slCountUp,
} from '../../../design-system/index.js';

const DAY = 24 * 3600e3;

/* ---------- sof yordamchilar (v3 dan saqlangan) ---------- */
function tsMs(ts) { return (ts && ts.toMillis) ? ts.toMillis() : (typeof ts === 'number' ? ts : Number(ts) || null); }

function fmtAgo(ts, isUz) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return isUz ? 'hozirgina' : 'только что';
  if (m < 60) return `${m} ${isUz ? 'daq oldin' : 'мин назад'}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${isUz ? 'soat oldin' : 'ч назад'}`;
  return `${Math.floor(h / 24)} ${isUz ? 'kun oldin' : 'дн назад'}`;
}
function fmtHours(ms, isUz) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} ${isUz ? 'soat' : 'ч'} ${m % 60} ${isUz ? 'daq' : 'мин'}` : `${m} ${isUz ? 'daq' : 'мин'}`;
}
function formatTimeLabel(ts, rk, isUz) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  if (rk === '1h' || rk === '24h') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (rk === '7d') {
    const days = isUz ? ['Yak', 'Dus', 'Ses', 'Chor', 'Pay', 'Jum', 'Sha']
      : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return `${days[d.getDay()]} ${pad(d.getDate())}`;
  }
  if (rk === '30d') return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  const mons = isUz ? ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
    : ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return `${mons[d.getMonth()]} ${d.getFullYear() % 100}`;
}
function gradeOf(sc) {
  if (sc >= 90) return { key: 'dash.gradeA', colorVar: '--sl-success' };
  if (sc >= 75) return { key: 'dash.gradeB', colorVar: '--sl-success' };
  if (sc >= 60) return { key: 'dash.gradeC', colorVar: '--sl-warning' };
  return { key: 'dash.gradeD', colorVar: '--sl-critical' };
}
/** Trend: oxirgi 3 nuqta vs avvalgi 3 nuqta o'rtachasi (v3 saqlangan). */
function calcTrend(pts, key) {
  const vals = pts.map((x) => x[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (vals.length < 4) return null;
  const last = vals.slice(-3), prev = vals.slice(-6, -3).length ? vals.slice(-6, -3) : vals.slice(0, -3);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const d = avg(last) - avg(prev);
  if (Math.abs(d) < 0.05) return { dir: 0, d };
  return { dir: d > 0 ? 1 : -1, d };
}
function seriesStats(pts, key) {
  const vals = pts.map((p) => Number(p[key])).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return {
    min: Math.min(...vals), max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
}
/* historyService nuqtalari -> slLineChart formati */
function toChartPoints(pts) {
  return pts.map((p) => ({ x: tsMs(p.ts), do: p.do, temp: p.t, ph: p.ph, tds: p.tds, nh3: p.nh3, battery: p.battery }))
    .filter((p) => p.x).sort((a, b) => a.x - b.x);
}

/* ============================================================
   ASOSIY SAHIFA
   ============================================================ */
export function renderLakeDetailPage(nav, lakeId) {
  const s = authStore.getState();
  const isUz = detectLocale() === 'uz';
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title', text: t('lake.detail') });

  // --- YUQORI QISM: appbar + qisqa ma'lumot + sticky tablar ---
  const summaryEl = el('div', {
    style: 'padding:var(--sl-sp-2) var(--sl-page-pad) var(--sl-sp-3);display:flex;'
      + 'align-items:center;justify-content:space-between;gap:var(--sl-sp-2);flex-wrap:wrap',
  });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [
      mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }),
      el('div', { class: 'grow' }, [titleEl]),
      mdIconButton({ icon: 'settings', label: t('lakedet.tab_settings'), onClick: () => {
        const st = dataStore.getState();
        const lk = st.lakes.find((l) => l.id === lakeId) || st.archivedLakes.find((l) => l.id === lakeId);
        if (lk) nav.push((n) => renderLakeFormPage(n, lk));
      } }),
    ]),
    summaryEl,
    content,
  ]);

  // --- TAB TIZIMI (sticky, DS) ---
  let activeTab = 'holat';
  const TAB_DEFS = [
    ['holat', 'lakedet.tab_now', 'activity'],
    ['tarix', 'lakedet.tab_history', 'trendUp'],
    ['ai', 'lakedet.tab_ai', 'sparkles'],
    ['sozlama', 'lakedet.tab_settings', 'settings'],
  ];
  const tabBtns = new Map();
  const tabBar = el('div', { class: 'sl-tabs sticky', role: 'tablist' }, TAB_DEFS.map(([id, key, ic]) => {
    const b = el('button', {
      class: 'sl-tab' + (id === activeTab ? ' active' : ''), type: 'button', role: 'tab',
      html: slIcon(ic, 15) + `<span>${t(key)}</span>`,
    });
    b.addEventListener('click', () => { if (activeTab !== id) { activeTab = id; render(); } });
    tabBtns.set(id, b);
    return b;
  }));
  root.insertBefore(tabBar, content);

  /* ----------------------------------------------------------
     AERATOR: tanlangan qurilma + qurilma tasdig'i (SAQLANGAN)
     ---------------------------------------------------------- */
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

  /* ---------- lazy tab keshlari (SAQLANGAN) ---------- */
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

  let lakeMeta = null;
  loadLakeMeta(lakeId).then((m) => { lakeMeta = m; render(); }).catch(() => {});

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

  /* ---------- 24h trend keshi (SAQLANGAN) ---------- */
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

  /* ---------- ob-havo (SAQLANGAN) ---------- */
  let weatherData = null;
  let weatherLoading = false;
  function loadWeather(lake) {
    if (weatherData || weatherLoading) return;
    weatherLoading = true;
    getLakeWeather(lake, detectLocale())
      .then((data) => { weatherData = data; render(); })
      .catch(() => { weatherLoading = false; });
  }

  /* ----------------------------------------------------------
     AERATOR ish-vaqti / elektr — oylik arxivdan (LAZY, 1 so'rov:
     oy diapazoni bugun+haftani ham qoplaydi -> qo'shimcha o'qish yo'q)
     ---------------------------------------------------------- */
  let runStats = null;         // { todayMs, weekMs, monthMs, lastOnTs }
  let runStatsLoading = false;
  function loadRunStats(devs) {
    if (runStats || runStatsLoading || !devs.length) return;
    runStatsLoading = true;
    const now = Date.now();
    const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    fetchArchive(s.uid, devs.map((d) => d.id), now - 30 * DAY, now)
      .then((samples) => {
        const inRange = (from) => samples.filter((sm) => sm.ts >= from);
        let lastOnTs = null;
        for (let i = 1; i < samples.length; i++) {
          if (samples[i].aer === 1 && samples[i - 1].aer !== 1) lastOnTs = samples[i].ts;
        }
        if (lastOnTs == null) { const on = samples.filter((sm) => sm.aer === 1); lastOnTs = on.length ? on[on.length - 1].ts : null; }
        runStats = {
          todayMs: aeratorRuntimeMs(inRange(startToday)),
          weekMs: aeratorRuntimeMs(inRange(now - 7 * DAY)),
          monthMs: aeratorRuntimeMs(samples),
          lastOnTs,
        };
        render();
      })
      .catch(() => { runStats = { todayMs: 0, weekMs: 0, monthMs: 0, lastOnTs: null }; render(); })
      .finally(() => { runStatsLoading = false; });
  }

  /* ----------------------------------------------------------
     TARIX tabidagi ko'p-davrli grafik — endi DS slLineChart'da
     (eski 500-satrlik inline-hex dvigatel o'rniga)
     ---------------------------------------------------------- */
  let rangeKey = '24h';

  const rangeChartBox = el('div');
  const rangeStatsBox = el('div', { class: 'sl-stack-sm', style: 'margin-top:var(--sl-sp-3)' });
  const rangeBtns = new Map();

  function statRow(seriesKey, label, st0, unit) {
    if (!st0) return null;
    return el('div', { class: 'sl-kv-row' }, [
      el('span', { class: 'kv-key' }, [
        el('span', { class: 'sl-swatch', style: `width:9px;height:9px;border-radius:3px;display:inline-block;background:var(--sl-chart-${seriesKey})` }),
        el('span', { text: label }),
      ]),
      el('span', { class: 'kv-val sl-caption', style: 'font-weight:700',
        text: `${t('lakedet.min')}: ${st0.min.toFixed(1)} · ${t('lakedet.avg')}: ${st0.avg.toFixed(1)} · ${t('lakedet.max')}: ${st0.max.toFixed(1)} ${unit}` }),
    ]);
  }

  let rangeReq = 0;
  async function loadRange(rk) {
    rangeKey = rk;
    rangeBtns.forEach((b, k) => b.classList.toggle('active', k === rk));
    const req = ++rangeReq;
    mount(rangeChartBox, el('div', { class: 'sl-skeleton card', style: 'height:220px;margin:0' }));
    rangeStatsBox.replaceChildren();
    try {
      const st = dataStore.getState();
      const devs = st.devices.filter((d) => d.lakeId === lakeId);
      let all = [];
      for (const d of devs) {
        const pts = await historyService.getHistory(d.id, rk);
        all = all.concat(pts || []);
      }
      if (req !== rangeReq) return;   // yangiroq so'rov bor — bunisi tashlanadi
      const points = toChartPoints(all);
      if (!points.length) {
        mount(rangeChartBox, slEmptyState({ icon: 'activity', title: t('common.noData'), desc: '' }));
      } else {
        const th = resolveThresholds(st.lakes.find((l) => l.id === lakeId));
        mount(rangeChartBox, el('div', { class: 'sl-chart-frame' }, [
          slLineChart({
            points,
            series: [
              { key: 'do', label: 'DO', unit: 'mg/L', area: true },
              { key: 'temp', label: t('tm.temp'), unit: '°C' },
              { key: 'ph', label: 'pH' },
            ],
            thresholds: [{ seriesKey: 'do', value: th.do.crit }],
            formatX: (x) => formatTimeLabel(x, rk, isUz),
            ariaLabel: t('tm.history'),
          }),
        ]));
        mount(rangeStatsBox,
          el('div', { class: 'sl-label', style: 'color:var(--sl-primary)', text: t('lakedet.rangeStats') }),
          ...[statRow('do', 'DO', seriesStats(points, 'do'), 'mg/L'),
            statRow('temp', t('tm.temp'), seriesStats(points, 'temp'), '°C'),
            statRow('ph', 'pH', seriesStats(points, 'ph'), '')].filter(Boolean));
      }
    } catch (e) {
      mount(rangeChartBox, slEmptyState({ icon: 'info', title: t(handleError(e, 'history').messageKey), desc: '' }));
    }
  }

  const rangeCard = slCard([
    el('div', { class: 'sl-card-head' }, [
      el('div', { class: 'sl-card-title', text: t('tm.history') }),
      el('span', {}, [slChartLegend([
        { key: 'do', label: 'DO' }, { key: 'temp', label: t('tm.temp') }, { key: 'ph', label: 'pH' },
      ])]),
    ]),
    el('div', { class: 'sl-tabs', style: 'padding:0 0 var(--sl-sp-2)' }, Object.keys(RANGES).map((rk) => {
      const b = el('button', { class: 'sl-tab' + (rk === rangeKey ? ' active' : ''), type: 'button',
        text: t('tm.range_' + rk) });
      b.addEventListener('click', () => loadRange(rk));
      rangeBtns.set(rk, b);
      return b;
    })),
    rangeChartBox,
    rangeStatsBox,
  ]);
  let rangeLoaded = false;

  /* ----------------------------------------------------------
     JORIY HOLAT bloklari
     ---------------------------------------------------------- */

  // Sensor kartasi: qiymat + me'yor + trend + status + bosilsa 24h grafik
  function sensorParamCard({ key, label, ic, value, unit, norm, stKey, tr, lastTs, ready = true }) {
    const stVar = stKey === 'healthy' ? '--sl-success' : stKey === 'warning' ? '--sl-warning'
      : stKey === 'critical' ? '--sl-critical' : '--sl-offline';
    const trendEl = tr == null
      ? el('span', { class: 'sl-caption', text: '' })
      : tr.dir === 0
        ? el('span', { class: 'sl-caption', style: 'color:var(--sl-offline);font-weight:700', text: `— ${t('lakedet.trendStable')}` })
        : el('span', { class: 'sl-caption', style: `font-weight:800;color:var(${tr.dir > 0 ? '--sl-success' : '--sl-warning'})`,
            html: slIcon(tr.dir > 0 ? 'trendUp' : 'trendDown', 12) + ` ${Math.abs(tr.d).toFixed(1)}` });
    const card = el('div', {
      class: 'sl-sensor', style: `--_c:var(--sl-chart-${key}, var(--sl-primary));text-align:left;cursor:pointer`,
      role: 'button', tabindex: '0', 'aria-label': label,
    }, [
      el('div', { class: 'sl-row-between' }, [
        el('span', { class: 'sn-lab' }, [
          el('span', { class: 'sl-ic', style: 'display:inline-flex', html: slIcon(ic, 13) }),
          el('span', { text: label }),
        ]),
        el('span', { style: `width:8px;height:8px;border-radius:50%;flex:none;background:var(${stVar});box-shadow:0 0 5px var(${stVar})` }),
      ]),
      el('div', { class: 'sn-val' }, [
        el('span', { class: 'sl-num', text: value != null ? String(value) : '—' }),
        unit ? el('span', { class: 'sn-unit', text: unit }) : null,
      ].filter(Boolean)),
      el('div', { class: 'sl-caption', style: 'margin-top:2px',
        text: ready ? `${t('lakedet.norm')}: ${norm}` : t('lakedet.aiReady') }),
      el('div', { class: 'sl-row-between', style: 'margin-top:4px' }, [
        trendEl,
        el('span', { class: 'sl-caption', text: fmtAgo(lastTs, isUz) }),
      ]),
    ]);
    const open = () => openSensorDialog({ key, label, unit, norm });
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    return card;
  }

  // Sensor bosilganda: 24h batafsil grafik dialogi
  function openSensorDialog({ key, label, unit, norm }) {
    const points = toChartPoints(trendPts);
    const stat = seriesStats(points, key);
    const body = el('div', {}, [
      points.length && stat ? el('div', { class: 'sl-chart-frame' }, [
        slLineChart({
          points, width: 480, height: 200,
          series: [{ key, label, unit, area: true }],
          formatX: (x) => formatTimeLabel(x, '24h', isUz),
          ariaLabel: label,
        }),
      ]) : slEmptyState({ icon: 'activity', title: t('common.noData'), desc: '' }),
      stat ? el('div', { class: 'sl-grid-3', style: 'margin-top:var(--sl-sp-3)' }, [
        ['min', stat.min], ['avg', stat.avg], ['max', stat.max],
      ].map(([k, v]) => el('div', { class: 'sl-sensor', style: `--_c:var(--sl-chart-${key}, var(--sl-primary));min-height:0` }, [
        el('div', { class: 'sn-lab' }, [el('span', { text: t('lakedet.' + k) })]),
        el('div', { class: 'sn-val' }, [
          el('span', { class: 'sl-num', style: 'font-size:18px', text: v.toFixed(1) }),
          unit ? el('span', { class: 'sn-unit', text: unit }) : null,
        ].filter(Boolean)),
      ]))) : null,
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: `${t('lakedet.norm')}: ${norm}` }),
    ].filter(Boolean));
    openDialog({ title: `${label} — ${t('lakedet.detailChart')}`, body,
      actions: [{ label: isUz ? 'Yopish' : 'Закрыть', variant: 'text' }] });
    const dlg = document.querySelector('.md-dialog');
    if (dlg) dlg.classList.add('wide');
  }

  /* ---------- kompozitsion render ---------- */
  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const lake = st.lakes.find((l) => l.id === lakeId) || st.archivedLakes.find((l) => l.id === lakeId);
    if (!lake) { mount(content, slEmptyState({ icon: 'droplet', title: t('error.lakeNotFound') })); return; }

    titleEl.textContent = lake.name;
    const th = resolveThresholds(lake);
    const devs = st.devices.filter((d) => d.lakeId === lakeId);
    const a = aggregateLake(devs, st.telemetry, th);
    const assignable = st.devices.filter((d) => !d.lakeId);
    const g = gradeOf(a.healthScore);
    const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');

    loadTrend(devs);
    loadWeather(lake);
    if (!selectedDevId || !devs.some((d) => d.id === selectedDevId)) {
      selectedDevId = devs.length ? devs[0].id : null;
    }
    pageAck.feed(selectedDevId ? st.telemetry.get(selectedDevId) : null);

    // --- SAHIFA-USTI QISQA MA'LUMOT ---
    let bestRssi = null;
    devs.forEach((d) => { const tel = st.telemetry.get(d.id);
      if (tel && typeof tel.rssi === 'number') bestRssi = bestRssi == null ? tel.rssi : Math.max(bestRssi, tel.rssi); });
    const sq = rssiQ(bestRssi);
    mount(summaryEl,
      el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2)' }, [
        slStatusBadge(lake.status === LAKE_STATUS.INACTIVE ? 'unknown' : (anyOnline ? 'online' : 'offline'),
          lake.status === LAKE_STATUS.INACTIVE ? t('lake.status_inactive') : (anyOnline ? 'Online' : 'Offline')),
        el('span', { class: 'sl-caption', text: `${t('tm.health')}: ` }),
        el('span', { class: 'sl-num-sm', style: `font-size:13px;color:var(${g.colorVar})`,
          text: devs.length ? `${a.healthScore}%` : '—' }),
      ]),
      el('div', { class: 'sl-caption', style: 'text-align:right' }, [
        el('div', { text: `${t('tm.lastUpdate')}: ${fmtAgo(a.lastUpdate, isUz)}` }),
        el('div', { text: `${t('dash.signal')}: ${t('dash.signal_' + sq)}${bestRssi != null ? ` (${bestRssi} dBm)` : ''}` }),
      ]));

    // ================= 1 · KO'L SALOMATLIGI (hero) =================
    const heroNum = el('span', { class: 'sl-num-lg', style: `font-size:42px;color:var(${g.colorVar})` });
    const healthHero = slCard([
      el('div', { class: 'sl-row-between' }, [
        el('div', {}, [
          el('div', { class: 'sl-label', style: 'color:var(--sl-text-secondary)', text: t('lakedet.health') }),
          el('div', { class: 'sl-row', style: 'align-items:baseline;gap:6px;margin-top:6px' }, [
            heroNum, el('span', { class: 'sl-num-md', style: `color:var(${g.colorVar})`, text: devs.length ? '%' : '' }),
          ]),
          el('div', { style: `margin-top:4px;font-weight:700;color:var(${g.colorVar})`,
            text: devs.length ? t(g.key) : t('common.noData') }),
          el('div', { class: 'sl-caption', style: 'margin-top:4px',
            text: `${a.online}/${a.deviceCount} ${t('tm.online')} · ${t('lakedet.aiReady')}` }),
        ]),
        slGaugeChart({ value: devs.length ? a.healthScore : null, min: 0, max: 100,
          unit: t('tm.health'), colorVar: g.colorVar, size: 116 }),
      ]),
    ], { elevated: true, premium: a.healthScore >= 90 && devs.length > 0,
      critical: a.healthScore <= 60 && devs.length > 0 });
    slCountUp(heroNum, devs.length ? a.healthScore : null, { decimals: 0 });

    // ================= 2 · SENSORLAR =================
    const evalDo = (v) => v == null ? 'unknown' : v < th.do.crit ? 'critical' : v < th.do.warn ? 'warning' : 'healthy';
    const evalTemp = (v) => v == null ? 'unknown' : (v < th.temp.critMin || v > th.temp.critMax) ? 'critical'
      : (v < th.temp.warnMin || v > th.temp.warnMax) ? 'warning' : 'healthy';
    const evalPh = (v) => v == null ? 'unknown' : (v < th.ph.critMin || v > th.ph.critMax) ? 'critical'
      : (v < th.ph.warnMin || v > th.ph.warnMax) ? 'warning' : 'healthy';
    const anyTel = devs.map((d) => st.telemetry.get(d.id)).filter(Boolean);
    const avgOf = (k) => { const v = anyTel.map((x) => x[k]).filter((n) => typeof n === 'number');
      return v.length ? Math.round((v.reduce((p, q) => p + q, 0) / v.length) * 10) / 10 : null; };
    const hasNh3 = anyTel.some((x) => typeof x.nh3 === 'number');
    const sensorCards = [
      sensorParamCard({ key: 'do', label: 'DO', ic: 'waves', value: a.avgDo, unit: 'mg/L',
        norm: `≥${th.do.warn}`, stKey: evalDo(a.avgDo), tr: calcTrend(trendPts, 'do'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'temp', label: t('tm.temp'), ic: 'thermometer', value: a.avgTemp, unit: '°C',
        norm: `${th.temp.warnMin}–${th.temp.warnMax}`, stKey: evalTemp(a.avgTemp), tr: calcTrend(trendPts, 't'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'ph', label: 'pH', ic: 'activity', value: a.avgPh, unit: '',
        norm: `${th.ph.warnMin}–${th.ph.warnMax}`, stKey: evalPh(a.avgPh), tr: calcTrend(trendPts, 'ph'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'tds', label: 'TDS', ic: 'layers', value: avgOf('tds'), unit: 'ppm',
        norm: '—', stKey: avgOf('tds') != null ? 'healthy' : 'unknown', tr: null, lastTs: a.lastUpdate,
        ready: avgOf('tds') != null }),
    ];
    if (hasNh3) {
      sensorCards.push(sensorParamCard({ key: 'nh3', label: isUz ? 'Ammiak' : 'Аммиак', ic: 'droplet',
        value: avgOf('nh3'), unit: 'mg/L', norm: '—', stKey: 'healthy', tr: null, lastTs: a.lastUpdate }));
    }
    sensorCards.push(sensorParamCard({ key: 'battery', label: t('lakedet.battery'), ic: 'battery',
      value: avgOf('battery'), unit: '%', norm: `≥${th.battery.warn}%`,
      stKey: avgOf('battery') != null && avgOf('battery') < th.battery.warn ? 'warning' : (avgOf('battery') != null ? 'healthy' : 'unknown'),
      tr: null, lastTs: a.lastUpdate }));
    const sensors = el('div', { class: 'sl-grid-2' }, sensorCards);

    // ================= 3 · 24h KISLOROD GRAFIGI =================
    const doPoints = toChartPoints(trendPts);
    const doStat = seriesStats(doPoints, 'do');
    const doChartCard = slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', text: t('lakedet.do24') }),
        el('span', { style: 'color:var(--sl-chart-do);display:inline-flex', html: slIcon('waves', 20) }),
      ]),
      doPoints.length ? el('div', { class: 'sl-chart-frame' }, [
        slLineChart({
          points: doPoints, height: 200,
          series: [{ key: 'do', label: 'DO', unit: 'mg/L', area: true }],
          thresholds: [{ seriesKey: 'do', value: th.do.crit }],
          formatX: (x) => formatTimeLabel(x, '24h', isUz),
          ariaLabel: t('lakedet.do24'),
        }),
      ]) : slEmptyState({ icon: 'activity', title: t('common.noData'), desc: '' }),
      doStat ? el('div', { class: 'sl-grid-3', style: 'margin-top:var(--sl-sp-3)' }, [
        ['min', doStat.min], ['avg', doStat.avg], ['max', doStat.max],
      ].map(([k, v]) => el('div', { class: 'sl-sensor', style: '--_c:var(--sl-chart-do);min-height:0' }, [
        el('div', { class: 'sn-lab' }, [el('span', { text: t('lakedet.' + k) })]),
        el('div', { class: 'sn-val' }, [
          el('span', { class: 'sl-num', style: 'font-size:18px', text: v.toFixed(1) }),
          el('span', { class: 'sn-unit', text: 'mg/L' }),
        ]),
      ]))) : null,
    ].filter(Boolean));

    // ================= 4 · AERATOR BOSHQARUVI =================
    loadRunStats(devs);
    const selTel = selectedDevId ? st.telemetry.get(selectedDevId) : null;
    const selOnline = selTel ? presence(selTel.ts) === 'online' : false;
    const aerOn = selTel && selTel.aer === 1;
    const isManual = selTel && selTel.manual === 1;

    const devChips = devs.length > 1 ? el('div', { class: 'sl-tabs', style: 'padding:0 0 var(--sl-sp-2)' },
      devs.map((d) => {
        const b = el('button', { class: 'sl-tab' + (d.id === selectedDevId ? ' active' : ''),
          type: 'button', text: d.id.slice(-6) });
        b.addEventListener('click', () => { selectedDevId = d.id; render(); });
        return b;
      })) : null;

    const btnAuto = slButton({ label: 'AUTO', icon: 'activity',
      variant: (!isManual && selOnline) ? 'primary' : 'outlined',
      onClick: () => sendAer(COMMAND_TYPES.AERATOR_OFF) });          // SAQLANGAN semantika
    const btnOn = slButton({ label: t('lakedet.forceOn'), icon: 'power',
      variant: isManual ? 'primary' : 'secondary',
      onClick: () => sendAer(COMMAND_TYPES.AERATOR_ON) });
    const btnOff = slButton({ label: t('lakedet.forceOff'), icon: 'power', variant: 'outlined' });
    btnOff.disabled = true;                                          // qurilmada yo'q (firmware cheklovi)
    if (!selectedDevId || !selOnline) { btnAuto.disabled = true; btnOn.disabled = true; }

    const kw = lakeMeta && lakeMeta.energy ? Number(lakeMeta.energy.kw) || 0 : 0;
    const tariff = lakeMeta && lakeMeta.energy ? Number(lakeMeta.energy.tariff) || 0 : 0;
    const kwhOf = (ms) => kw ? (ms / 3600e3) * kw : null;
    const fmtKwh = (ms) => {
      const v = kwhOf(ms);
      if (v == null) return t('lakedet.energyNeedKw');
      const cost = tariff ? ` · ≈${Math.round(v * tariff).toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '';
      return `${v.toFixed(1)} kWh${cost}`;
    };
    const rsVal = (fn) => runStats ? fn(runStats) : (runStatsLoading ? '…' : '—');

    const aeratorCard = slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('power', 18) }),
          el('span', { text: t('lakedet.aerator') }),
        ]),
        slBadge({ type: aerOn ? 'online' : 'offline', label: aerOn ? t('lakedet.working') : t('lakedet.stopped') }),
      ]),
      devChips,
      el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap' }, [btnAuto, btnOn, btnOff]),
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('lakedet.offNote') }),
      el('div', { style: 'margin-top:var(--sl-sp-2)' }, [
        slKvRow({ icon: 'settings', key: t('lakedet.mode'),
          value: isManual
            ? t('lakedet.manual') + (selTel && selTel.man_remain > 0 ? ` (${selTel.man_remain} ${isUz ? 'daq' : 'мин'})` : '')
            : (selTel && selTel.mode === 1 ? t('lakedet.autoTime') : t('lakedet.autoDo')) }),
        slKvRow({ icon: 'clock', key: t('lakedet.lastCmd'),
          value: selTel && selTel.last_cmd_ts ? fmtAgo(selTel.last_cmd_ts, isUz) : '—' }),
        slKvRow({ icon: 'power', key: t('lakedet.lastOn'),
          value: rsVal((r) => r.lastOnTs ? fmtAgo(r.lastOnTs, isUz) : '—') }),
        slKvRow({ icon: 'clock', key: t('lakedet.runToday'),
          value: rsVal((r) => fmtHours(r.todayMs, isUz)) }),
        slKvRow({ icon: 'clock', key: t('lakedet.runWeek'),
          value: rsVal((r) => fmtHours(r.weekMs, isUz)) }),
        slKvRow({ icon: 'zap', key: t('lakedet.kwhToday'),
          value: rsVal((r) => fmtKwh(r.todayMs)), valueColorVar: '--sl-chart-energy' }),
        slKvRow({ icon: 'zap', key: t('lakedet.kwhMonth'),
          value: rsVal((r) => fmtKwh(r.monthMs)), valueColorVar: '--sl-chart-energy' }),
      ]),
    ]);

    // ================= 5 · YEM TAVSIYASI =================
    const feedPlan = lakeMeta ? computeFeedPlan({ fish: lakeMeta.fish || [], feed: lakeMeta.feed || {},
      tempC: a.avgTemp, weather: weatherData }) : null;
    let feedBody;
    if (feedPlan) {
      feedBody = el('div', {}, [
        el('div', { class: 'sl-caption', style: 'margin-bottom:var(--sl-sp-1)', text: t('lakedet.feedMealOnce') + ':' }),
        el('div', { style: 'display:flex;gap:6px;margin-bottom:var(--sl-sp-2);flex-wrap:wrap' },
          feedPlan.meals.map((m) => el('div', {
            class: 'sl-sensor', style: '--_c:var(--sl-chart-feed);flex:1;min-height:0;text-align:center;padding:8px 4px',
          }, [
            el('div', { class: 'sn-lab', style: 'justify-content:center', text: m.time }),
            el('div', { class: 'sn-val', style: 'justify-content:center' }, [
              el('span', { class: 'sl-num', style: 'font-size:15px', text: m.kg.toFixed(1) }),
              el('span', { class: 'sn-unit', text: 'kg' }),
            ]),
          ]))),
        ...(feedPlan.notes || []).map((n) => el('div', { class: 'sl-banner warn', style: 'margin-bottom:var(--sl-sp-2)' }, [
          el('span', { style: 'display:inline-flex;flex:none', html: slIcon('alertTriangle', 15) }),
          el('span', { text: n.text }),
        ])),
        slKvRow({ icon: 'fish', key: t('lakedet.biomass'), value: `${feedPlan.biomass.toFixed(0)} kg` }),
        slKvRow({ icon: 'thermometer', key: `${t('lakedet.rate')} (${a.avgTemp != null ? a.avgTemp + '°C' : '—'})`,
          value: `${feedPlan.ratePct}% / ${isUz ? 'kun' : 'день'}` }),
        slKvRow({ icon: 'feed', key: t('lakedet.feedTotal'), value: `${feedPlan.dailyKg.toFixed(1)} kg`,
          valueColorVar: '--sl-chart-feed' }),
        slKvRow({ icon: 'zap', key: t('lakedet.feedCost'),
          value: feedPlan.dailyCost != null ? `≈${Math.round(feedPlan.dailyCost).toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '—',
          valueColorVar: '--sl-primary' }),
        el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('lakedet.feedAiNote') }),
      ]);
    } else {
      feedBody = el('div', {}, [
        el('div', { class: 'sl-body-sm sl-text-secondary', text: t('lakedet.feedEmpty') }),
        el('div', { class: 'sl-caption', style: 'margin-top:4px', text: t('lakedet.feedAiNote') }),
        el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
          slButton({ label: t('lakedet.toSettings'), variant: 'secondary',
            onClick: () => { activeTab = 'sozlama'; render(); } }),
        ]),
      ]);
    }
    const feedCard = slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-chart-feed);display:inline-flex', html: slIcon('feed', 18) }),
          el('span', { text: t('lakedet.feed') }),
        ]),
        slBadge({ type: 'success', label: 'kg', dot: false, icon: 'feed' }),
      ]),
      feedBody,
    ]);

    // ================= 6 · ALOQA HOLATI =================
    const connCard = slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('wifi', 18) }),
          el('span', { text: t('lakedet.conn') }),
        ]),
      ]),
      ...(devs.length ? devs.map((d) => {
        const tel = st.telemetry.get(d.id) || null;
        const pres = tel ? presence(tel.ts) : 'offline';
        const q = rssiQ(tel && tel.rssi != null ? Number(tel.rssi) : null);
        return el('div', { class: 'sl-kv-row' }, [
          el('div', { class: 'kv-key', style: 'flex-direction:column;align-items:flex-start;gap:2px' }, [
            el('span', { class: 'sl-mono', style: 'font-size:12.5px;font-weight:700;color:var(--sl-text-primary)', text: d.id }),
            el('span', { class: 'sl-caption', text: `${t('dash.lastContact')}: ${fmtAgo(tel && tel.ts, isUz)}`
              + (tel && tel.battery != null ? ` · ${t('lakedet.battery')} ${tel.battery}%` : '') }),
          ]),
          el('div', { style: 'text-align:right' }, [
            slStatusBadge(pres === 'online' ? 'online' : 'offline', pres === 'online' ? 'Online' : 'Offline'),
            el('div', { class: 'sl-caption', style: 'margin-top:3px;font-variant-numeric:tabular-nums',
              text: tel && tel.rssi != null ? `RSSI ${tel.rssi} dBm · ${t('dash.signal_' + q)}` : 'RSSI —' }),
          ]),
        ]);
      }) : [el('div', { class: 'sl-body-sm sl-text-secondary', text: t('lake.noDevices') })]),
    ]);

    // ================= 7 · OB-HAVO (SAQLANGAN) =================
    let weatherCardNode = null;
    if (weatherData) {
      const wIc = getWeatherIcon(weatherData.code);
      const wxCell = (labKey, temp, label, colorVar) => el('div', {
        class: 'sl-sensor', style: `--_c:var(${colorVar});min-height:0`,
      }, [
        el('div', { class: 'sn-lab', text: t(labKey) }),
        el('div', { class: 'sn-val' }, [
          el('span', { class: 'sl-ic', style: 'display:inline-flex;margin-right:4px', html: slIcon(wIc, 18) }),
          el('span', { class: 'sl-num', style: 'font-size:18px', text: `${temp}°C` }),
        ]),
        el('div', { class: 'sl-caption', style: 'margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: label }),
      ]);
      weatherCardNode = slCard([
        el('div', { class: 'sl-card-head' }, [
          el('div', { class: 'sl-card-title', text: t('lakedet.weatherRegion') }),
          slBadge({ type: 'info', label: weatherData.district, dot: false }),
        ]),
        el('div', { class: 'sl-grid-2' }, [
          wxCell('lakedet.weatherToday', weatherData.temp, weatherData.label, '--sl-info'),
          wxCell('lakedet.weatherTomorrow', weatherData.tomorrowTempMax, weatherData.tomorrowLabel, '--sl-primary'),
        ]),
      ]);
    } else if (weatherLoading) {
      weatherCardNode = slCard([el('div', {
        style: 'display:flex;align-items:center;justify-content:center;height:64px',
        class: 'sl-body-sm sl-text-secondary',
      }, [el('span', { text: t('lakedet.loadingWeather') })])]);
    }

    // ================= SOZLAMALAR qo'shimchalari (SAQLANGAN) =================
    const deviceRows = devs.length ? devs.map((d) => slListItem({
      leading: 'chip', title: d.id,
      trailing: el('div', { class: 'sl-row', style: 'gap:6px' }, [
        slStatusBadge(deviceStatus(st.telemetry.get(d.id) || null, th), t('tm.status_' + deviceStatus(st.telemetry.get(d.id) || null, th))),
        slButton({ label: t('lake.unassign'), variant: 'text', size: 'sm', onClick: async (ev) => {
          ev.stopPropagation();
          try { await deviceAssignmentService.unassign(lake.id, d.id, s.uid); await dataStore.refresh(); toast(t('lake.unassigned'), 'ok'); }
          catch (e) { toast(t(handleError(e, 'unassign').messageKey), 'err'); }
        } }),
      ]),
      onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
    })) : [el('div', { class: 'sl-body-sm sl-text-secondary', style: 'padding:8px 4px', text: t('lake.noDevices') })];

    const assignRow = [];
    if (assignable.length) {
      const sel = slSelect([{ value: '', label: t('lake.selectDevice') }, ...assignable.map((d) => ({ value: d.id, label: d.id }))], '');
      const btn = slButton({ label: t('lake.assign'), variant: 'secondary', onClick: async () => {
        if (!sel.value) return;
        try { await deviceAssignmentService.assign(lake.id, sel.value, s.uid); await dataStore.refresh(); toast(t('lake.assigned'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'assign').messageKey), 'err'); }
      } });
      assignRow.push(el('div', { class: 'sl-row', style: 'gap:8px;margin-top:10px' }, [el('div', { class: 'sl-grow' }, [sel]), btn]));
    }
    const devicesCard = slCard([
      el('div', { class: 'sl-card-title', style: 'margin-bottom:4px', text: t('lake.attachedDevices') }),
      el('div', {}, deviceRows),
      ...assignRow,
    ]);

    const archived = lake.status === LAKE_STATUS.ARCHIVED;
    const actions = [];
    if (!archived) {
      const toggle = lake.status === LAKE_STATUS.ACTIVE ? LAKE_STATUS.INACTIVE : LAKE_STATUS.ACTIVE;
      actions.push(slButton({ label: t(lake.status === LAKE_STATUS.ACTIVE ? 'lake.deactivate' : 'lake.activate'), variant: 'outlined', full: true, onClick: async () => {
        try { await lakeService.setStatus(lake.id, toggle, s.uid); await dataStore.refresh(); toast(t('common.saved'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
      } }));
      actions.push(slButton({ label: t('lake.archive'), variant: 'text', full: true, onClick: () => {
        openDialog({ title: t('lake.archive') + '?', body: t('lake.archiveConfirm'), actions: [
          { label: t('common.cancel'), variant: 'text' },
          { label: t('lake.archive'), variant: 'text', onClick: async () => {
            try { await lakeService.archive(lake.id, s.uid); await dataStore.refresh(); toast(t('lake.archived'), 'ok'); nav.back(); }
            catch (e) { toast(t(handleError(e, 'archive').messageKey), 'err'); }
          } },
        ] });
      } }));
    } else {
      actions.push(slButton({ label: t('lake.restore'), variant: 'primary', full: true, onClick: () => {
        openDialog({ title: t('lake.restore') + '?', body: t('lake.restoreConfirm'), actions: [
          { label: t('common.cancel'), variant: 'text' },
          { label: t('lake.restore'), variant: 'primary', onClick: async () => {
            try { await lakeService.setStatus(lake.id, LAKE_STATUS.ACTIVE, s.uid); await dataStore.refresh(); toast(t('lake.restored'), 'ok'); nav.back(); }
            catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
          } },
        ] });
      } }));
    }

    // ================= TAB KOMPOZITSIYASI =================
    tabBtns.forEach((b, id) => b.classList.toggle('active', id === activeTab));
    let components;
    if (activeTab === 'tarix') {
      if (!rangeLoaded) { rangeLoaded = true; loadRange(rangeKey); }
      components = [rangeCard, getHistoryTabNode()];
    } else if (activeTab === 'ai') components = [getAiTabNode()];
    else if (activeTab === 'sozlama') components = [getSettingsTabNode(), devicesCard, ...actions];
    else {
      components = [healthHero, sensors, doChartCard, aeratorCard, feedCard, connCard];
      if (weatherCardNode) components.push(weatherCardNode);
    }
    mount(content, el('div', { class: 'sl-stack sl-anim-fade' }, components));
  }

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = () => { unsub(); pageAck.cancel(); };
  return root;
}

export default renderLakeDetailPage;
