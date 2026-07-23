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
import { historyService } from '../../telemetry/services/historyService.js';
import { sensorState, SENSOR_STATE } from '../../telemetry/domain/sensorState.js';
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
  slSelect, slEmptyState, slKvRow, slLineChart,
  slCountUp,
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

  /* ---------- lazy tab keshlari ---------- */
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

  /* ---------- 48h PER-QURILMA trend keshi (LAKEDET-V5) ----------
     Har qurilma alohida: qurilma 24h buferi ∪ arxivdan oldingi 24h
     (5-daq dedupe, arxiv ustuvor) — servislar O'ZGARTIRILMAGAN. */
  const deviceTrends = new Map();   // devId -> { pts, loading }
  function loadTrend48(devId) {
    const c = deviceTrends.get(devId);
    if (c && (c.loading || c.pts)) return;
    deviceTrends.set(devId, { loading: true, pts: null });
    const now = Date.now();
    Promise.all([
      historyService.getHistory(devId, '24h').catch(() => []),
      fetchArchive(s.uid, [devId], now - 2 * DAY, now).catch(() => []),
    ]).then(([buf, arch]) => {
      const seen = new Set(arch.map((x) => Math.floor(x.ts / 300e3)));
      const pts = arch.concat((buf || []).filter((x) => !seen.has(Math.floor(x.ts / 300e3))))
        .sort((a, b) => a.ts - b.ts);
      deviceTrends.set(devId, { loading: false, pts });
      render();
    });
  }
  /* Sensor kartalari trendi uchun: birinchi qurilma nuqtalari. */
  function firstDevPts(devs) {
    const first = devs.length ? deviceTrends.get(devs[0].id) : null;
    return (first && first.pts) || [];
  }
  function loadTrend(devs) { devs.forEach((d) => loadTrend48(d.id)); }
  let trendPts = [];   // render'da firstDevPts bilan yangilanadi (dialoglar uchun)

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
     AERATOR ish-vaqti — 7 kunlik arxivdan (LAZY, 1 so'rov:
     hafta diapazoni bugunni ham qoplaydi). Elektr (kWh) hisobi
     Hisobot bo'limida — bu yerda takrorlanmaydi (LAKEDET-V5).
     ---------------------------------------------------------- */
  let runStats = null;         // { todayMs, weekMs, lastOnTs }
  let runStatsLoading = false;
  function loadRunStats(devs) {
    if (runStats || runStatsLoading || !devs.length) return;
    runStatsLoading = true;
    const now = Date.now();
    const startToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    fetchArchive(s.uid, devs.map((d) => d.id), now - 7 * DAY, now)
      .then((samples) => {
        const inRange = (from) => samples.filter((sm) => sm.ts >= from);
        let lastOnTs = null;
        for (let i = 1; i < samples.length; i++) {
          if (samples[i].aer === 1 && samples[i - 1].aer !== 1) lastOnTs = samples[i].ts;
        }
        if (lastOnTs == null) { const on = samples.filter((sm) => sm.aer === 1); lastOnTs = on.length ? on[on.length - 1].ts : null; }
        runStats = {
          todayMs: aeratorRuntimeMs(inRange(startToday)),
          weekMs: aeratorRuntimeMs(samples),
          lastOnTs,
        };
        render();
      })
      .catch(() => { runStats = { todayMs: 0, weekMs: 0, lastOnTs: null }; render(); })
      .finally(() => { runStatsLoading = false; });
  }

  /* ----------------------------------------------------------
     TARIX tabi — HAR QURILMA ALOHIDA (LAKEDET-V5).
     Sensorlar o'rtachasi CHIQARILMAYDI: qurilma tanlanadi va
     buildHistoryTab getDevs=()=>[o'sha qurilma] bilan quriladi —
     historyTab O'ZGARTIRILMAGAN, filtr/jadval(pagination)/eksport
     (tugmalar yuqorida)/elektr/yem hammasi qurilma kesimida.
     ---------------------------------------------------------- */
  let historyDevId = null;
  const historyNodes = new Map();   // devId -> tayyor Node (lazy kesh)
  function historyForDevice(devId) {
    if (!historyNodes.has(devId)) {
      historyNodes.set(devId, buildHistoryTab({
        lakeId, uid: s.uid, isUz,
        getDevs: () => {
          const st2 = dataStore.getState();
          return st2.devices.filter((d) => d.id === devId);   // FAQAT shu qurilma
        },
        getTh: () => {
          const st2 = dataStore.getState();
          const lk = st2.lakes.find((l) => l.id === lakeId) || st2.archivedLakes.find((l) => l.id === lakeId);
          return resolveThresholds(lk);
        },
      }));
    }
    return historyNodes.get(devId);
  }

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
    trendPts = firstDevPts(devs);
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
    // LAKEDET-V5: yuqori-o'ng burchakda ALOQA SIFATI (alohida karta yo'q)
    const sigPct = bestRssi == null ? null
      : Math.max(0, Math.min(100, Math.round(((bestRssi + 120) / 70) * 100)));
    const heroNum = el('span', { class: 'sl-num-lg', style: `font-size:42px;color:var(${g.colorVar})` });
    const signalBlock = el('div', {
      style: 'text-align:right;flex:none;padding:var(--sl-sp-2) var(--sl-sp-3);'
        + 'border-radius:var(--sl-r-md);background:var(--sl-card-inset)',
    }, [
      el('div', { class: 'sl-row', style: 'gap:5px;justify-content:flex-end' }, [
        el('span', { style: `display:inline-flex;color:var(--sl-chart-rssi)`, html: slIcon('wifi', 15) }),
        el('span', { class: 'sl-num-sm', style: 'font-size:15px;color:var(--sl-chart-rssi)',
          text: sigPct == null ? '—' : `${sigPct}%` }),
      ]),
      el('div', { class: 'sl-caption', text: `${t('dash.signal_' + sq)}${bestRssi != null ? ` · ${bestRssi} dBm` : ''}` }),
      el('div', { class: 'sl-caption', text: fmtAgo(a.lastUpdate, isUz) }),
    ]);
    const healthHero = slCard([
      el('div', { class: 'sl-row-between', style: 'align-items:flex-start' }, [
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
        signalBlock,
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
    // LAKEDET-V5: 0 = nosozlik EMAS — sensor mavjudlik holati (sensorState)
    const STATE_TEXT = {
      [SENSOR_STATE.ABSENT]: t('lakedet.sensorAbsent'),
      [SENSOR_STATE.DISABLED]: t('lakedet.sensorDisabled'),
      [SENSOR_STATE.CALIBRATION]: t('lakedet.sensorCalib'),
    };
    function lakeState(key) {
      let best = SENSOR_STATE.ABSENT;
      for (const tel of anyTel) {
        const st0 = sensorState(tel, key);
        if (st0 === SENSOR_STATE.PRESENT) return SENSOR_STATE.PRESENT;
        if (st0 !== SENSOR_STATE.ABSENT) best = st0;
      }
      return best;
    }
    const tdsState = lakeState('tds');
    const nh3State = lakeState('nh3');
    const hasNh3 = nh3State === SENSOR_STATE.PRESENT;
    const sensorCards = [
      sensorParamCard({ key: 'do', label: 'DO', ic: 'waves', value: a.avgDo, unit: 'mg/L',
        norm: `≥${th.do.warn}`, stKey: evalDo(a.avgDo), tr: calcTrend(trendPts, 'do'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'temp', label: t('tm.temp'), ic: 'thermometer', value: a.avgTemp, unit: '°C',
        norm: `${th.temp.warnMin}–${th.temp.warnMax}`, stKey: evalTemp(a.avgTemp), tr: calcTrend(trendPts, 't'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'ph', label: 'pH', ic: 'activity', value: a.avgPh, unit: '',
        norm: `${th.ph.warnMin}–${th.ph.warnMax}`, stKey: evalPh(a.avgPh), tr: calcTrend(trendPts, 'ph'), lastTs: a.lastUpdate }),
      sensorParamCard({ key: 'tds', label: 'TDS', ic: 'layers',
        value: tdsState === SENSOR_STATE.PRESENT ? avgOf('tds') : null, unit: 'ppm',
        norm: tdsState === SENSOR_STATE.PRESENT ? '—' : STATE_TEXT[tdsState],
        stKey: tdsState === SENSOR_STATE.PRESENT ? 'healthy' : 'unknown',
        tr: null, lastTs: a.lastUpdate }),
    ];
    if (nh3State !== SENSOR_STATE.ABSENT) {
      sensorCards.push(sensorParamCard({ key: 'nh3', label: isUz ? 'Ammiak' : 'Аммиак', ic: 'droplet',
        value: hasNh3 ? avgOf('nh3') : null, unit: 'mg/L',
        norm: hasNh3 ? '—' : STATE_TEXT[nh3State],
        stKey: hasNh3 ? 'healthy' : 'unknown', tr: null, lastTs: a.lastUpdate }));
    }
    sensorCards.push(sensorParamCard({ key: 'battery', label: t('lakedet.battery'), ic: 'battery',
      value: avgOf('battery'), unit: '%', norm: `≥${th.battery.warn}%`,
      stKey: avgOf('battery') != null && avgOf('battery') < th.battery.warn ? 'warning' : (avgOf('battery') != null ? 'healthy' : 'unknown'),
      tr: null, lastTs: a.lastUpdate }));
    const sensors = el('div', { class: 'sl-grid-2' }, sensorCards);

    // ================= 3 · 48h KISLOROD GRAFIKLARI (har qurilma) =================
    // LAKEDET-V5: o'rtacha grafik CHIQARILMAYDI — har qurilma alohida.
    const fmtX48 = (x) => {
      const d = new Date(x); const pd = (n) => String(n).padStart(2, '0');
      return `${pd(d.getDate())}.${pd(d.getMonth() + 1)} ${pd(d.getHours())}:${pd(d.getMinutes())}`;
    };
    const deviceChartCards = devs.map((d) => {
      const tr = deviceTrends.get(d.id);
      const pts = toChartPoints((tr && tr.pts) || []);
      const st0 = seriesStats(pts, 'do');
      let bodyNode;
      if (tr && tr.loading) {
        bodyNode = el('div', { class: 'sl-skeleton card', style: 'height:200px;margin:0' });
      } else if (!pts.length) {
        bodyNode = slEmptyState({ icon: 'activity', title: t('common.noData'), desc: '' });
      } else {
        bodyNode = el('div', { class: 'sl-chart-frame' }, [
          slLineChart({
            points: pts, height: 200,
            series: [{ key: 'do', label: 'DO', unit: 'mg/L', area: true }],
            thresholds: [{ seriesKey: 'do', value: th.do.crit }],
            formatX: fmtX48,                      // tooltip: sana + soat + qiymat
            ariaLabel: `${t('lakedet.do48')} · ${d.id}`,
          }),
        ]);
      }
      return slCard([
        el('div', { class: 'sl-card-head' }, [
          el('div', { class: 'sl-card-title', text: t('lakedet.do48') }),
          slBadge({ type: 'info', dot: false, icon: 'chip',
            label: `${t('lakedet.deviceOf')} ${d.id.slice(-6)}` }),
        ]),
        bodyNode,
        st0 ? el('div', { class: 'sl-grid-3', style: 'margin-top:var(--sl-sp-3)' }, [
          ['min', st0.min], ['avg', st0.avg], ['max', st0.max],
        ].map(([k, v]) => el('div', { class: 'sl-sensor', style: '--_c:var(--sl-chart-do);min-height:0' }, [
          el('div', { class: 'sn-lab' }, [el('span', { text: t('lakedet.' + k) })]),
          el('div', { class: 'sn-val' }, [
            el('span', { class: 'sl-num', style: 'font-size:18px', text: v.toFixed(1) }),
            el('span', { class: 'sn-unit', text: 'mg/L' }),
          ]),
        ]))) : null,
      ].filter(Boolean));
    });

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

    // LAKEDET-V5: elektr (kWh) hisobi Hisobot bo'limida — bu yerda takrorlanmaydi
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
      ]),
    ]);

    // LAKEDET-V5: Yem tavsiyasi bu tabdan OLIB TASHLANDI (Dashboard va
    // Ko'llar kartalarida bor — takror chiqmaydi); Aloqa holati alohida
    // karta emas — salomatlik kartasining yuqori-o'ng blokida.

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
    // LAKEDET-V5: Sozlamalarda qurilma qatorlari — nom, holat, oxirgi aloqa
    const deviceRows = devs.length ? devs.map((d) => {
      const tel = st.telemetry.get(d.id) || null;
      const devSt = deviceStatus(tel, th);
      return slListItem({
        leading: 'chip', title: d.id,
        subtitle: `${t('dash.lastContact')}: ${fmtAgo(tel && tel.ts, isUz)}`,
        trailing: el('div', { class: 'sl-row', style: 'gap:6px' }, [
          slStatusBadge(devSt, t('tm.status_' + devSt)),
          slButton({ label: t('lake.unassign'), variant: 'text', size: 'sm', onClick: async (ev) => {
            ev.stopPropagation();
            try { await deviceAssignmentService.unassign(lake.id, d.id, s.uid); await dataStore.refresh(); toast(t('lake.unassigned'), 'ok'); }
            catch (e) { toast(t(handleError(e, 'unassign').messageKey), 'err'); }
          } }),
        ]),
        onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
      });
    }) : [el('div', { class: 'sl-body-sm sl-text-secondary', style: 'padding:8px 4px', text: t('lake.noDevices') })];

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
      // LAKEDET-V5: har qurilma alohida — o'rtacha chiqarilmaydi
      if (!devs.length) {
        components = [slEmptyState({ icon: 'chip', title: t('lake.noDevices'), desc: '' })];
      } else {
        if (!historyDevId || !devs.some((d) => d.id === historyDevId)) historyDevId = devs[0].id;
        const devTabs = devs.length > 1 ? el('div', { class: 'sl-tabs', role: 'tablist', style: 'padding:0' },
          devs.map((d) => {
            const b = el('button', { class: 'sl-tab' + (d.id === historyDevId ? ' active' : ''),
              type: 'button', role: 'tab', text: `${t('lakedet.deviceOf')} ${d.id.slice(-6)}` });
            b.addEventListener('click', () => { historyDevId = d.id; render(); });
            return b;
          })) : null;
        components = [devTabs, historyForDevice(historyDevId)].filter(Boolean);
      }
    } else if (activeTab === 'ai') components = [getAiTabNode()];
    else if (activeTab === 'sozlama') components = [devicesCard, getSettingsTabNode(), ...actions];   // qurilmalar ENG YUQORIDA
    else {
      components = [healthHero, sensors, ...deviceChartCards];
      components.push(aeratorCard);
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
