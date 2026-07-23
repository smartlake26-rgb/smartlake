// ============================================================
//  features/telemetry/views/historyTab.js — DATA HISTORY v4
//  SOF SENSOR TARIXI markazi (HIST-V4, Design System 3.0)
//
//  Bu modulda ELEKTR, YEM va MOLIYAVIY hisoblar YO'Q — ular
//  Hisobot moduliga (reportModule.js) KO'CHIRILDI (funksiya
//  yo'qolmagan, faqat joyi o'zgargan — topshiriq bo'yicha).
//
//  Tuzilishi: sarlavha (ko'l nomi · qurilma · davr) + EKSPORT
//  TUGMALARI YUQORIDA -> sana filtri (reusable buildDateFilter)
//  -> summary (o'rtacha DO/Harorat/pH/TDS + yozuvlar) -> HAR
//  SENSOR UCHUN ALOHIDA interaktiv grafik (slHistoryChart:
//  tooltip sana+soat+qiymat, ZOOM va PAN) -> jadval (slTable:
//  sticky/saralash/qidiruv/pagination) -> pull-to-refresh,
//  bo'sh/xatolik holatlari.
//
//  EKSPORT: XOM sample'lar TO'LIQ — hech narsa qisqartirilmaydi
//  (kunlik/haftalik/oylik/yillik barcha yozuvlar; PDF avtomatik
//  ko'p sahifa). Jadval/grafik ko'rinishi esa o'qish qulayligi
//  uchun davr-bucket'larda (faqat DISPLEY, eksportga ta'sir yo'q).
//
//  SAQLANGAN: ma'lumot oqimi (fetchArchive ∪ qurilma 24h buferi,
//  5-daq dedupe), buildHistoryTab imzosi (+ixtiyoriy lakeName).
//  Firmware/Firebase Business Logic'ga TEGILMAGAN.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { historyService } from '../services/historyService.js';
import { fetchArchive } from '../services/archiveService.js';
import { buildDateFilter } from '../components/dateFilter.js';
import { buildExportToolbar } from '../components/exportToolbar.js';
import {
  slIcon, slCard, slButton, slBadge, slTable, slEmptyState,
  slHistoryChart, slCountUp,
} from '../../../design-system/index.js';

const DAY = 24 * 3600e3;
const PULL_THRESHOLD = 80;

/* ---------- sof formatlagichlar ---------- */
const p2 = (n) => String(n).padStart(2, '0');
function fmtDate(ts) { const d = new Date(ts); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function fmtTime(ts) { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; }
function nfmt(v, d = 1) { return v == null ? '—' : Number(v).toFixed(d); }
const avgArr = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/* Displey-bucket agregatsiya (faqat jadval/grafik uchun; eksport XOM). */
function aggregateLocal(samples, bucketMs) {
  const buckets = new Map();
  for (const sm of samples) {
    const key = Math.floor(sm.ts / bucketMs) * bucketMs;
    let b = buckets.get(key);
    if (!b) { b = { ts: key, n: 0, sdo: 0, ndo: 0, st: 0, nt: 0, sph: 0, nph: 0, stds: 0, ntds: 0 }; buckets.set(key, b); }
    b.n += 1;
    if (typeof sm.do === 'number') { b.sdo += sm.do; b.ndo += 1; }
    if (typeof sm.t === 'number') { b.st += sm.t; b.nt += 1; }
    if (typeof sm.ph === 'number') { b.sph += sm.ph; b.nph += 1; }
    if (typeof sm.tds === 'number') { b.stds += sm.tds; b.ntds += 1; }
  }
  return [...buckets.values()].map((b) => ({
    ts: b.ts, n: b.n,
    do: b.ndo ? b.sdo / b.ndo : null,
    t: b.nt ? b.st / b.nt : null,
    ph: b.nph ? b.sph / b.nph : null,
    tds: b.ntds ? b.stds / b.ntds : null,
  })).sort((a, b) => a.ts - b.ts);
}

/**
 * Data History moduli (imzo mos: eski chaqiruvlar ishlayveradi).
 * @param {{lakeId, uid, isUz, getDevs, getTh, lakeName?:string}} p
 */
export function buildHistoryTab({ lakeId, uid, isUz, getDevs, getTh, lakeName = '' }) {
  let samples = [];   // XOM sample'lar — eksport TO'LIQ shulardan
  let rows = [];      // displey-bucket qatorlar
  let loading = false;
  let firstLoad = true;

  const dateFilter = buildDateFilter({ initial: 'bugun', onChange: () => loadData() });
  function bucketFor(spanMs) {
    if (spanMs <= DAY) return 30 * 60e3;
    if (spanMs <= 7 * DAY) return 3 * 3600e3;
    if (spanMs <= 31 * DAY) return 12 * 3600e3;
    return DAY;
  }
  const fmtX = (ts) => {
    const [f, to] = dateFilter.getRange();
    return (to - f) <= DAY * 2 ? fmtTime(ts)
      : `${p2(new Date(ts).getDate())}.${p2(new Date(ts).getMonth() + 1)} ${fmtTime(ts)}`;
  };

  function statusOf(doAvg) {
    const th = getTh();
    if (doAvg == null) return { key: 'unknown', label: '—', badge: 'neutral' };
    if (doAvg < th.do.crit) return { key: 'crit', label: t('hist.st_crit'), badge: 'critical' };
    if (doAvg < th.do.warn) return { key: 'warn', label: t('hist.st_warn'), badge: 'warning' };
    return { key: 'normal', label: t('hist.st_normal'), badge: 'healthy' };
  }

  /* ---------- SARLAVHA + EKSPORT (doim yuqorida) ---------- */
  const devLabel = () => {
    const devs = getDevs();
    return devs.length === 1 ? devs[0].id
      : devs.length ? `${devs.length} ${t('lake.devices')}` : '—';
  };
  const headSub = el('div', { class: 'sl-caption' });
  function refreshHead() {
    const [f, to] = dateFilter.getRange();
    headSub.textContent = [lakeName, `${t('lakedet.deviceOf')}: ${devLabel()}`,
      `${fmtDate(f)} — ${fmtDate(to)}`].filter(Boolean).join(' · ');
  }

  // EKSPORT: xom sample'lar TO'LIQ (qisqartirish YO'Q)
  const exportToolbar = buildExportToolbar({
    getFileBase: () => `smartlake-tarix-${dateFilter.getId()}`,
    getTitle: () => {
      const [f, to] = dateFilter.getRange();
      return `SmartLake — ${t('hist.title')} · ${lakeName || lakeId} · ${devLabel()} · ${fmtDate(f)}–${fmtDate(to)}`;
    },
    getSheets: () => [{
      name: t('hist.sheetHistory'),
      rows: samples.map((sm) => ({
        [t('hist.colDate')]: fmtDate(sm.ts),
        [t('hist.colTime')]: fmtTime(sm.ts),
        'DO (mg/L)': typeof sm.do === 'number' ? +sm.do.toFixed(2) : '',
        [`${t('tm.temp')} (°C)`]: typeof sm.t === 'number' ? +sm.t.toFixed(1) : '',
        pH: typeof sm.ph === 'number' ? +sm.ph.toFixed(2) : '',
        'TDS (ppm)': typeof sm.tds === 'number' ? Math.round(sm.tds) : '',
        [t('hist.colStatus')]: statusOf(sm.do).label,
      })),
    }],
  });

  /* ---------- konteynerlar ---------- */
  const summaryBox = el('div');
  const chartsBox = el('div', { class: 'sl-stack' });
  const tableBox = el('div');
  const pullHint = el('div', { class: 'sl-caption',
    style: 'text-align:center;height:0;overflow:hidden;transition:height var(--sl-motion) var(--sl-ease)',
    text: t('hist.pullRefresh') });

  /* ---------- SUMMARY (sensor o'rtachalari + yozuvlar) ---------- */
  function sumCard({ ic, label, numVal, decimals = 1, colorVar }) {
    const numEl = el('div', { class: 'sl-num-md sl-stat-num', style: `color:var(${colorVar})` });
    const card = el('div', { class: 'sl-stat' }, [
      el('div', { class: 'sl-stat-ic', style: `background:color-mix(in srgb, var(${colorVar}) 12%, transparent);color:var(${colorVar})`, html: slIcon(ic, 20) }),
      el('div', {}, [numEl, el('div', { class: 'sl-stat-lab', text: label })]),
    ]);
    if (numVal != null && Number.isFinite(numVal)) slCountUp(numEl, numVal, { decimals });
    else numEl.textContent = '—';
    return card;
  }
  function renderSummary() {
    const val = (k) => avgArr(rows.map((r) => r[k]).filter((v) => v != null));
    mount(summaryBox, el('div', { class: 'sl-grid-2' }, [
      sumCard({ ic: 'waves', label: t('hist.sum_do'), numVal: val('do'), colorVar: '--sl-chart-do' }),
      sumCard({ ic: 'thermometer', label: t('hist.sum_temp'), numVal: val('t'), colorVar: '--sl-chart-temp' }),
      sumCard({ ic: 'activity', label: t('hist.sum_ph'), numVal: val('ph'), decimals: 2, colorVar: '--sl-chart-ph' }),
      sumCard({ ic: 'layers', label: t('hist.sum_tds'), numVal: val('tds'), decimals: 0, colorVar: '--sl-chart-rssi' }),
    ]));
  }

  /* ---------- HAR SENSOR UCHUN ALOHIDA GRAFIK (zoom+pan) ---------- */
  const SENSORS = [
    ['do', 'DO', 'mg/L', 'do'], ['t', null, '°C', 'temp'],
    ['ph', 'pH', '', 'ph'], ['tds', 'TDS', 'ppm', 'rssi'],
  ];
  function renderCharts() {
    const th = getTh();
    const zoomLabels = { zoomIn: t('hist.zoomIn'), zoomOut: t('hist.zoomOut'),
      reset: t('hist.resetZoom'), prev: t('hist.panPrev'), next: t('hist.panNext') };
    const cards = SENSORS.map(([k, lb, unit, colorKey]) => {
      const label = k === 't' ? t('tm.temp') : lb;
      const pts = rows.filter((r) => typeof r[k] === 'number')
        .map((r) => ({ x: r.ts, [colorKey]: r[k] }));
      if (!pts.length) return null;
      return slCard([
        el('div', { class: 'sl-card-head' }, [
          el('div', { class: 'sl-card-title', text: label }),
          slBadge({ type: 'info', dot: false, label: unit || '·' }),
        ]),
        slHistoryChart({
          points: pts, height: 190,
          series: [{ key: colorKey, label, unit, area: true }],
          thresholds: k === 'do' ? [{ seriesKey: 'do', value: th.do.crit }] : [],
          formatX: fmtX,                                  // tooltip: sana + soat + qiymat
          ariaLabel: label, labels: zoomLabels,
        }),
      ]);
    }).filter(Boolean);
    mount(chartsBox, ...(cards.length ? cards : [el('span')]));
  }

  /* ---------- JADVAL (sticky/saralash/qidiruv/pagination) ---------- */
  function renderTable() {
    if (!rows.length) {
      mount(tableBox, slCard([slEmptyState({ icon: 'trendUp', title: t('hist.empty'), desc: t('hist.emptyDesc') })]));
      return;
    }
    const table = slTable({
      pageSize: 15, searchable: true,
      labels: { search: t('hist.searchPh') },
      filters: [{ key: '__st', label: t('hist.statusFilter'),
        options: [
          { value: 'normal', label: t('hist.st_normal') },
          { value: 'warn', label: t('hist.st_warn') },
          { value: 'crit', label: t('hist.st_crit') },
        ],
        test: (r, v) => statusOf(r.do).key === v }],
      columns: [
        { key: 'date', label: t('hist.colDate'), value: (r) => fmtDate(r.ts) },
        { key: 'time', label: t('hist.colTime'), value: (r) => fmtTime(r.ts) },
        { key: 'do', label: 'DO', numeric: true, value: (r) => (r.do != null ? +r.do.toFixed(2) : null),
          render: (r) => el('span', { style: 'color:var(--sl-chart-do);font-weight:700', text: nfmt(r.do) }) },
        { key: 't', label: t('tm.temp'), numeric: true, value: (r) => (r.t != null ? +r.t.toFixed(1) : null),
          render: (r) => el('span', { style: 'color:var(--sl-chart-temp)', text: nfmt(r.t) }) },
        { key: 'ph', label: 'pH', numeric: true, value: (r) => (r.ph != null ? +r.ph.toFixed(2) : null),
          render: (r) => el('span', { style: 'color:var(--sl-chart-ph)', text: nfmt(r.ph, 2) }) },
        { key: 'tds', label: 'TDS', numeric: true, value: (r) => (r.tds != null ? Math.round(r.tds) : null),
          render: (r) => el('span', { style: 'color:var(--sl-chart-rssi)', text: r.tds != null ? String(Math.round(r.tds)) : '—' }) },
        { key: 'st', label: t('hist.colStatus'), value: (r) => statusOf(r.do).label,
          render: (r) => { const s0 = statusOf(r.do); return slBadge({ type: s0.badge, label: s0.label }); } },
      ],
      rows: rows.slice().reverse(),
      emptyText: t('hist.empty'),
    });
    mount(tableBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', text: t('hist.tableTitle') }),
        slBadge({ type: 'info', label: String(rows.length), dot: false }),
      ]),
      table,
    ]));
  }

  /* ---------- yuklash + holatlar ---------- */
  function skeletonAll() {
    mount(summaryBox, el('div', { class: 'sl-grid-2' },
      Array.from({ length: 4 }, () => el('div', { class: 'sl-skeleton card', style: 'height:84px;margin:0' }))));
    mount(chartsBox, el('div', { class: 'sl-skeleton card', style: 'height:220px' }));
    mount(tableBox, el('div', { class: 'sl-skeleton card', style: 'height:200px' }));
  }
  function renderError() {
    mount(summaryBox); mount(chartsBox);
    mount(tableBox, slCard([slEmptyState({
      icon: 'info', title: t('hist.loadError'),
      desc: navigator.onLine ? '' : t('lakespg.offlineNet'),
      action: slButton({ label: t('hist.retry'), variant: 'secondary', onClick: () => loadData() }),
    })]));
  }

  async function loadData() {
    if (loading) return;
    loading = true;
    refreshHead();
    skeletonAll();
    try {
      const devs = getDevs();
      const ids = devs.map((d) => d.id);
      const [fromTs, toTs] = dateFilter.getRange();
      // SAQLANGAN oqim: arxiv ∪ (davr bugunni qamrasa) qurilma 24h buferi
      const arch = await fetchArchive(uid, ids, fromTs, toTs);
      let rtdb = [];
      if (toTs >= Date.now() - DAY && ids.length) {
        const pts = await historyService.getHistory(ids[0], '24h').catch(() => []);
        rtdb = pts.filter((x) => x.ts >= fromTs && x.ts <= toTs);
      }
      const seen = new Set(arch.map((x) => Math.floor(x.ts / 300e3)));
      samples = arch.concat(rtdb.filter((x) => !seen.has(Math.floor(x.ts / 300e3))))
        .sort((a, b) => a.ts - b.ts);
      rows = aggregateLocal(samples, bucketFor(toTs - fromTs));
      renderSummary(); renderCharts(); renderTable();
      if (!firstLoad) toast(t('hist.refreshed'), 'ok');
      firstLoad = false;
    } catch (e) {
      renderError();
    } finally { loading = false; }
  }

  /* ---------- yig'ish + pull-to-refresh ---------- */
  const node = el('div', { class: 'sl-stack' }, [
    pullHint,
    slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', {}, [
          el('div', { class: 'sl-card-title', text: t('hist.title') }),
          headSub,
        ]),
        el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('download', 18) }),
      ]),
      dateFilter.node,
      // EKSPORT — DOIM YUQORIDA (jadval oxirigacha tushish shart emas)
      el('div', { style: 'margin-top:var(--sl-sp-2)' }, [exportToolbar]),
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)', text: t('hist.exportFull') }),
    ]),
    summaryBox, chartsBox, tableBox,
  ]);

  let pullStartY = null;
  node.addEventListener('touchstart', (e) => {
    pullStartY = (window.scrollY <= 0) ? e.touches[0].clientY : null;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (pullStartY == null) return;
    pullHint.style.height = (e.touches[0].clientY - pullStartY) > 24 ? '20px' : '0';
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (pullStartY == null) return;
    const dy = e.changedTouches[0].clientY - pullStartY;
    pullHint.style.height = '0'; pullStartY = null;
    if (dy > PULL_THRESHOLD && !loading) loadData();
  }, { passive: true });

  loadData();
  return node;
}

export default buildHistoryTab;
