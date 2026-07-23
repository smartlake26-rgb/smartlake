// ============================================================
//  features/telemetry/views/historyTab.js — TARIX VA HISOBOT v3
//  "Analitika markazi" (HIST-V3, Design System 3.0)
//
//  Tuzilishi: filtrlar (Bugun/Kecha/7 kun/30 kun/Yil/Ixtiyoriy
//  sana) -> Summary kartalari (bosilsa batafsil grafik) ->
//  Grafiklar (DO/Harorat/pH/TDS + kunlik elektr + kunlik yem) ->
//  Sensorlar jadvali (slTable: qidiruv/saralash/filtr/pagination/
//  sticky) -> Elektr bo'limi (davr + bugun/hafta/oy + aeratorlar
//  bo'yicha) -> Yem statistikasi (bugun/hafta/oy/yil/davr +
//  ovqatlanish vaqtlari) -> Eksport (XLSX ko'p varaqli / CSV /
//  PDF bo'limli) + pull-to-refresh + xatolik/bo'sh holatlar.
//
//  SAQLANGAN (v2): ma'lumot oqimi (fetchArchive ∪ qurilma 24h
//  buferi, 5-daq dedupe, arxiv ustuvor), davr-bucket agregatsiya
//  mantiqiy, kW/tarif kiritish + saveLakeMeta, feedEngine
//  hisoblari, dynamic-import eksport (xlsx/jspdf), chaqiruv
//  imzosi buildHistoryTab({lakeId,uid,isUz,getDevs,getTh}) —
//  lakeDetailPage va reportsTab'da o'zgarishsiz ishlaydi.
//
//  Firmware/Firebase Business Logic'ga TEGILMAGAN. TDS jadval
//  ustuni uchun agregatsiya shu faylda LOKAL bajariladi
//  (archiveService o'zgartirilmagan).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { openDialog } from '../../../shared/ui/index.js';
import { historyService } from '../services/historyService.js';
import {
  fetchArchive, aeratorRuntimeMs, loadLakeMeta, saveLakeMeta,
} from '../services/archiveService.js';
import { computeFeedPlan, periodFeedTotals } from '../domain/feedEngine.js';
import {
  slIcon, slCard, slButton, slBadge, slField, slTable, slKvRow,
  slEmptyState, slLineChart, slBarChart, slCountUp,
} from '../../../design-system/index.js';

const DAY = 24 * 3600e3;
const PULL_THRESHOLD = 80;

/* ---------- sof formatlagichlar ---------- */
const p2 = (n) => String(n).padStart(2, '0');
function fmtDate(ts) { const d = new Date(ts); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function fmtTime(ts) { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; }
function fmtDur(ms, isUz) {
  const m = Math.round(ms / 60000); const h = Math.floor(m / 60);
  return h > 0 ? `${h} ${isUz ? 'soat' : 'ч'} ${m % 60} ${isUz ? 'daq' : 'мин'}` : `${m} ${isUz ? 'daq' : 'мин'}`;
}
function nfmt(v, d = 1) { return v == null ? '—' : Number(v).toFixed(d); }
const avgArr = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/* Lokal agregatsiya: archiveService'dagi bilan bir mantiq + TDS + n.
   (Servisga tegilmagan — bu faqat ko'rinish qatlami ehtiyoji.) */
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

/** Kunlik kesim: [{dayTs, samples[]}] */
function byDay(samples) {
  const m = new Map();
  for (const sm of samples) {
    const d = new Date(sm.ts); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(sm);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([dayTs, arr]) => ({ dayTs, samples: arr }));
}

/**
 * Tarix va Hisobot tabini quradi (imzo O'ZGARMAGAN).
 * @param {{lakeId:string, uid:string, isUz:boolean, getDevs:()=>Array, getTh:()=>object}} p
 */
export function buildHistoryTab({ lakeId, uid, isUz, getDevs, getTh }) {
  /* ---------- holat ---------- */
  let filter = 'bugun';
  let customFrom = null; let customTo = null;
  let samples = [];       // xom sample'lar (elektr/yem/kunlik grafiklar)
  let rows = [];          // bucket-agregat qatorlar (jadval/grafik/summary)
  let loading = false;
  let loadFailed = false;
  let meta = null;        // lakeMeta (energy/fish/feed/aerators)
  let firstLoad = true;

  const FILTERS = [
    ['bugun', 'hist.f_today'], ['kecha', 'hist.f_yesterday'],
    ['hafta', 'hist.f_7d'], ['oy', 'hist.f_30d'],
    ['yil', 'hist.f_year'], ['sana', 'hist.f_custom'],
  ];
  function rangeFor(f) {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    if (f === 'bugun') return [startToday.getTime(), now];
    if (f === 'kecha') return [startToday.getTime() - DAY, startToday.getTime() - 1];
    if (f === 'hafta') return [now - 7 * DAY, now];
    if (f === 'oy') return [now - 30 * DAY, now];
    if (f === 'yil') return [now - 365 * DAY, now];
    return [customFrom || startToday.getTime(), (customTo || now) + DAY - 1];
  }
  function bucketFor(spanMs) {
    if (spanMs <= DAY) return 30 * 60e3;
    if (spanMs <= 7 * DAY) return 3 * 3600e3;
    if (spanMs <= 31 * DAY) return 12 * 3600e3;
    return DAY;
  }
  function fmtX(ts) {
    const span = rangeFor(filter); const s = span[1] - span[0];
    if (s <= DAY * 2) return fmtTime(ts);
    return `${p2(new Date(ts).getDate())}.${p2(new Date(ts).getMonth() + 1)}`;
  }

  /* ---------- holat bahosi (SAQLANGAN mantiq) ---------- */
  function statusOf(doAvg) {
    const th = getTh();
    if (doAvg == null) return { key: 'unknown', label: '—', badge: 'neutral' };
    if (doAvg < th.do.crit) return { key: 'crit', label: t('hist.st_crit'), badge: 'critical' };
    if (doAvg < th.do.warn) return { key: 'warn', label: t('hist.st_warn'), badge: 'warning' };
    return { key: 'normal', label: t('hist.st_normal'), badge: 'healthy' };
  }

  /* ---------- elektr yordamchilari ---------- */
  const kwTotal = () => parseFloat(kwIn.input.value) || (meta && meta.energy && meta.energy.kw) || 0;
  const tariffVal = () => parseFloat(tarifIn.input.value) || (meta && meta.energy && meta.energy.tariff) || 0;
  const kwhOf = (ms) => { const kw = kwTotal(); return kw ? (ms / 3600e3) * kw : null; };
  const costOf = (kwh) => { const tf = tariffVal(); return kwh != null && tf ? Math.round(kwh * tf) : null; };
  const sum = (v) => (v != null ? `${Math.round(v).toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '—');
  const aerSamples = () => samples.filter((x) => 'aer' in x);
  /** cutoffTs dan beri ish vaqti — faqat davr uni qamrasa. */
  function runSince(cutoff) {
    const [fromTs] = rangeFor(filter);
    if (fromTs > cutoff) return null;                       // davr qamramaydi
    return aeratorRuntimeMs(aerSamples().filter((x) => x.ts >= cutoff));
  }

  /* ---------- yem yordamchilari ---------- */
  function feedPlanFor(tempC) {
    if (!meta) return null;
    return computeFeedPlan({ fish: meta.fish || [], feed: meta.feed || {}, tempC });
  }
  function periodPlan() {
    return feedPlanFor(avgArr(rows.map((r) => r.t).filter((v) => v != null)));
  }

  /* ============================================================
     UI QISMLARI (bir marta quriladi)
     ============================================================ */

  /* --- filtrlar --- */
  const filterBtns = new Map();
  const filterRow = el('div', { class: 'sl-tabs', role: 'tablist', style: 'padding:0' },
    FILTERS.map(([id, key]) => {
      const b = el('button', { class: 'sl-tab' + (id === filter ? ' active' : ''), type: 'button',
        role: 'tab', text: t(key) });
      b.addEventListener('click', () => {
        filter = id;
        filterBtns.forEach((x, xid) => x.classList.toggle('active', xid === filter));
        customRow.style.display = id === 'sana' ? 'flex' : 'none';
        if (id !== 'sana') loadData();
      });
      filterBtns.set(id, b);
      return b;
    }));

  const fromIn = slField({ type: 'date', label: t('hist.from') });
  const toIn = slField({ type: 'date', label: t('hist.to') });
  [fromIn, toIn].forEach((f) => { f.querySelector('.sl-help').remove(); f.style.flex = '1'; f.style.minWidth = '130px'; });
  const customRow = el('div', { style: 'display:none;gap:var(--sl-sp-2);margin-top:var(--sl-sp-2);align-items:flex-end;flex-wrap:wrap' }, [
    fromIn, toIn,
    slButton({ label: t('hist.show'), variant: 'secondary', onClick: () => {
      customFrom = fromIn.input.value ? new Date(fromIn.input.value + 'T00:00:00').getTime() : null;
      customTo = toIn.input.value ? new Date(toIn.input.value + 'T00:00:00').getTime() : null;
      if (!customFrom) { toast(t('hist.pickDate'), 'err'); return; }
      loadData();
    } }),
  ]);

  /* --- konteynerlar --- */
  const summaryBox = el('div');
  const chartsBox = el('div');
  const tableBox = el('div');
  const energyBox = el('div');
  const feedStatBox = el('div');
  const pullHint = el('div', { class: 'sl-caption', style: 'text-align:center;height:0;overflow:hidden;transition:height var(--sl-motion) var(--sl-ease)', text: t('hist.pullRefresh') });

  /* ============================================================
     SUMMARY KARTALARI (bosilsa batafsil grafik)
     ============================================================ */
  function sumCard({ ic, label, valText, numVal, decimals = 1, colorVar, onClick }) {
    const numEl = el('div', { class: 'sl-num-md sl-stat-num', style: `color:var(${colorVar})` });
    const card = el('div', { class: 'sl-stat interactive', role: 'button', tabindex: '0', 'aria-label': label }, [
      el('div', { class: 'sl-stat-ic', style: `background:color-mix(in srgb, var(${colorVar}) 12%, transparent);color:var(${colorVar})`, html: slIcon(ic, 20) }),
      el('div', {}, [numEl, el('div', { class: 'sl-stat-lab', text: label })]),
    ]);
    if (numVal != null && Number.isFinite(numVal)) slCountUp(numEl, numVal, { decimals });
    else numEl.textContent = valText != null ? valText : '—';
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } });
    return card;
  }

  function chartPoints(key) {
    return rows.map((r) => ({ x: r.ts, [key]: r[key] })).filter((r) => r.x);
  }
  function openSeriesDialog(key, label, unit) {
    const pts = chartPoints(key);
    const vals = pts.map((x) => x[key]).filter((v) => typeof v === 'number');
    openDialog({ title: `${label} — ${t('hist.detailChart')}`,
      body: el('div', {}, [
        vals.length ? el('div', { class: 'sl-chart-frame' }, [
          slLineChart({ points: pts, width: 480, height: 200,
            series: [{ key, label, unit, area: true }], formatX: fmtX, ariaLabel: label }),
        ]) : slEmptyState({ icon: 'activity', title: t('hist.empty'), desc: '' }),
        vals.length ? el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)',
          text: `Min: ${nfmt(Math.min(...vals))} · ${t('lakedet.avg')}: ${nfmt(avgArr(vals))} · Max: ${nfmt(Math.max(...vals))} ${unit}` }) : null,
      ].filter(Boolean)),
      actions: [{ label: isUz ? 'Yopish' : 'Закрыть', variant: 'text' }] });
    const dlg = document.querySelector('.md-dialog'); if (dlg) dlg.classList.add('wide');
  }
  function dailyEnergyBars() {
    return byDay(aerSamples()).map(({ dayTs, samples: ds }) => {
      const kwh = kwhOf(aeratorRuntimeMs(ds));
      return { label: `${p2(new Date(dayTs).getDate())}.${p2(new Date(dayTs).getMonth() + 1)}`,
        value: kwh != null ? +kwh.toFixed(2) : +(aeratorRuntimeMs(ds) / 3600e3).toFixed(2), key: 'energy' };
    });
  }
  function dailyFeedBars() {
    return byDay(samples).map(({ dayTs, samples: ds }) => {
      const plan = feedPlanFor(avgArr(ds.map((x) => x.t).filter((v) => typeof v === 'number')));
      return { label: `${p2(new Date(dayTs).getDate())}.${p2(new Date(dayTs).getMonth() + 1)}`,
        value: plan ? +plan.dailyKg.toFixed(1) : 0, key: 'feed' };
    });
  }
  function openBarsDialog(title, bars, unit) {
    openDialog({ title,
      body: bars.length ? el('div', { class: 'sl-chart-frame' }, [
        slBarChart({ bars, width: 480, height: 200, unit, ariaLabel: title }),
      ]) : slEmptyState({ icon: 'activity', title: t('hist.empty'), desc: '' }),
      actions: [{ label: isUz ? 'Yopish' : 'Закрыть', variant: 'text' }] });
    const dlg = document.querySelector('.md-dialog'); if (dlg) dlg.classList.add('wide');
  }

  function renderSummary() {
    const val = (k) => avgArr(rows.map((r) => r[k]).filter((v) => v != null));
    const runMs = aerSamples().length ? aeratorRuntimeMs(aerSamples()) : null;
    const kwh = runMs != null ? kwhOf(runMs) : null;
    const plan = periodPlan();
    const [fromTs, toTs] = rangeFor(filter);
    const days = Math.max(1, Math.round((toTs - fromTs) / DAY));
    const feedKg = plan ? periodFeedTotals(plan, days).kg : null;
    mount(summaryBox, el('div', { class: 'sl-grid-2' }, [
      sumCard({ ic: 'waves', label: t('hist.sum_do'), numVal: val('do'), colorVar: '--sl-chart-do',
        onClick: () => openSeriesDialog('do', 'DO', 'mg/L') }),
      sumCard({ ic: 'thermometer', label: t('hist.sum_temp'), numVal: val('t'), colorVar: '--sl-chart-temp',
        onClick: () => openSeriesDialog('t', t('tm.temp'), '°C') }),
      sumCard({ ic: 'activity', label: t('hist.sum_ph'), numVal: val('ph'), decimals: 2, colorVar: '--sl-chart-ph',
        onClick: () => openSeriesDialog('ph', 'pH', '') }),
      sumCard({ ic: 'layers', label: t('hist.sum_tds'), numVal: val('tds'), decimals: 0, colorVar: '--sl-chart-rssi',
        onClick: () => openSeriesDialog('tds', 'TDS', 'ppm') }),
      sumCard({ ic: 'clock', label: t('hist.sum_runtime'), valText: runMs != null ? fmtDur(runMs, isUz) : '—',
        colorVar: '--sl-primary', onClick: () => openBarsDialog(t('hist.chart_energyDaily'), dailyEnergyBars(), 'kWh') }),
      sumCard({ ic: 'zap', label: t('hist.sum_energy'), numVal: kwh, valText: '—', colorVar: '--sl-chart-energy',
        onClick: () => openBarsDialog(t('hist.chart_energyDaily'), dailyEnergyBars(), 'kWh') }),
      sumCard({ ic: 'feed', label: t('hist.sum_feed'), numVal: feedKg, valText: '—', colorVar: '--sl-chart-feed',
        onClick: () => openBarsDialog(t('hist.chart_feedDaily'), dailyFeedBars(), 'kg') }),
      sumCard({ ic: 'trendUp', label: t('hist.rows'), numVal: rows.length, decimals: 0, colorVar: '--sl-info',
        onClick: () => { /* jadvalga scroll */ tableBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }),
    ]));
  }

  /* ============================================================
     GRAFIKLAR (parametr tanlovli + kunlik elektr/yem)
     ============================================================ */
  let chartParam = 'do';
  const PARAMS = [
    ['do', 'DO', 'mg/L'], ['t', null, '°C'], ['ph', 'pH', ''], ['tds', 'TDS', 'ppm'],
    ['energy', null, 'kWh'], ['feed', null, 'kg'],
  ];
  function paramLabel(k, lb) {
    if (k === 't') return t('tm.temp');
    if (k === 'energy') return t('hist.sum_energy');
    if (k === 'feed') return t('hist.sum_feed');
    return lb;
  }
  function renderCharts() {
    const paramTabs = el('div', { class: 'sl-tabs', style: 'padding:0 0 var(--sl-sp-2)' },
      PARAMS.map(([k, lb]) => {
        const b = el('button', { class: 'sl-tab' + (k === chartParam ? ' active' : ''), type: 'button',
          text: paramLabel(k, lb) });
        b.addEventListener('click', () => { chartParam = k; renderCharts(); });
        return b;
      }));
    let chartNode;
    if (chartParam === 'energy' || chartParam === 'feed') {
      const bars = chartParam === 'energy' ? dailyEnergyBars() : dailyFeedBars();
      chartNode = bars.length
        ? el('div', { class: 'sl-chart-frame' }, [slBarChart({ bars, height: 210,
            unit: chartParam === 'energy' ? 'kWh' : 'kg', ariaLabel: t('hist.chartsTitle') })])
        : slEmptyState({ icon: 'activity', title: t('hist.empty'), desc: '' });
    } else {
      const [, lb, unit] = PARAMS.find((x) => x[0] === chartParam);
      const pts = chartPoints(chartParam);
      const has = pts.some((x) => typeof x[chartParam] === 'number');
      const key = chartParam === 't' ? 'temp' : chartParam;   // rang tokeni uchun
      chartNode = has
        ? el('div', { class: 'sl-chart-frame' }, [slLineChart({
            points: pts.map((x) => ({ x: x.x, [key]: x[chartParam] })), height: 210,
            series: [{ key, label: paramLabel(chartParam, lb), unit, area: true }],
            formatX: fmtX, ariaLabel: paramLabel(chartParam, lb) })])
        : slEmptyState({ icon: 'activity', title: t('hist.empty'), desc: '' });
    }
    mount(chartsBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', text: t('hist.chartsTitle') }),
        el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('trendUp', 18) }),
      ]),
      paramTabs, chartNode,
    ]));
  }

  /* ============================================================
     JADVAL (slTable: qidiruv/saralash/filtr/pagination/sticky)
     ============================================================ */
  function renderTable() {
    if (!rows.length) {
      mount(tableBox, slCard([slEmptyState({ icon: 'trendUp', title: t('hist.empty'), desc: t('hist.emptyDesc') })]));
      return;
    }
    const data = rows.slice().reverse();
    const table = slTable({
      pageSize: 15,
      searchable: true,
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
        { key: 'n', label: t('hist.colOnline'), numeric: true, value: (r) => r.n },
      ],
      rows: data,
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

  /* ============================================================
     ELEKTR BO'LIMI
     ============================================================ */
  const kwIn = slField({ type: 'number', label: t('hist.kw'), attrs: { min: '0', step: '0.1' }, placeholder: '1.5' });
  const tarifIn = slField({ type: 'number', label: t('hist.tariff'), attrs: { min: '0', step: '1' }, placeholder: '1000' });
  [kwIn, tarifIn].forEach((f) => { f.querySelector('.sl-help').remove(); f.style.flex = '1'; f.style.minWidth = '120px'; });
  const saveEnergyBtn = slButton({ label: t('common.save'), variant: 'secondary', onClick: async () => {
    const kw = parseFloat(kwIn.input.value) || 0; const tariff = parseFloat(tarifIn.input.value) || 0;
    try {
      await saveLakeMeta(lakeId, uid, { energy: { kw, tariff } });   // SAQLANGAN yozuv yo'li
      meta = { ...(meta || {}), energy: { kw, tariff } };
      toast(t('common.saved'), 'ok');
      renderEnergy(); renderSummary(); renderCharts();
    } catch (e) { toast((e && e.message) || 'Xato', 'err'); }
  } });

  function renderEnergy() {
    const hasAer = aerSamples().length > 0;
    const runMs = hasAer ? aeratorRuntimeMs(aerSamples()) : null;
    const kwh = runMs != null ? kwhOf(runMs) : null;
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const periods = [
      ['hist.e_today', runSince(startToday.getTime())],
      ['hist.e_week', runSince(now - 7 * DAY)],
      ['hist.e_month', runSince(now - 30 * DAY)],
      ['hist.e_total', runMs],
    ];
    const periodRows = periods.map(([key, ms]) => {
      const k2 = ms != null ? kwhOf(ms) : null;
      return slKvRow({ icon: 'zap', key: t(key),
        value: ms == null ? `— (${t('hist.widen')})`
          : k2 != null ? `${k2.toFixed(2)} kWh · ${sum(costOf(k2))}` : fmtDur(ms, isUz),
        valueColorVar: ms == null ? '--sl-text-disabled' : '--sl-chart-energy' });
    });

    // Aeratorlar bo'yicha (meta.aerators: {count, model, kw — har biri})
    const aer = meta && meta.aerators;
    let perAer;
    if (aer && (aer.count || aer.kw)) {
      const count = Math.max(1, Number(aer.count) || 1);
      const kwEach = Number(aer.kw) || 0;
      perAer = el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
        el('div', { class: 'sl-label', style: 'color:var(--sl-text-secondary);margin-bottom:var(--sl-sp-1)', text: t('hist.perAerator') }),
        ...Array.from({ length: count }, (_, i) => {
          const ms = runMs != null ? runMs : 0;
          const k2 = kwEach ? (ms / 3600e3) * kwEach : null;
          return slKvRow({ icon: 'power',
            key: `${t('hist.aerN')} ${i + 1}${aer.model ? ` · ${aer.model}` : ''}${kwEach ? ` · ${kwEach} kW` : ''}`,
            value: `${fmtDur(ms, isUz)}${k2 != null ? ` · ${k2.toFixed(2)} kWh · ${sum(costOf(k2))}` : ''}` });
        }),
      ]);
    } else {
      perAer = el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.needAer') });
    }

    mount(energyBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-chart-energy);display:inline-flex', html: slIcon('zap', 18) }),
          el('span', { text: t('hist.energyTitle') }),
        ]),
      ]),
      el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);align-items:flex-end;flex-wrap:wrap;margin-bottom:var(--sl-sp-2)' }, [
        kwIn, tarifIn, saveEnergyBtn,
      ]),
      slKvRow({ icon: 'clock', key: t('hist.runTime'), value: hasAer ? fmtDur(runMs, isUz) : '—' }),
      slKvRow({ icon: 'zap', key: t('hist.consumption'),
        value: kwh != null ? `${kwh.toFixed(2)} kWh` : '—', valueColorVar: '--sl-chart-energy' }),
      slKvRow({ icon: 'zap', key: t('hist.cost'), value: sum(costOf(kwh)), valueColorVar: '--sl-primary' }),
      ...periodRows,
      perAer,
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.energyNote') }),
    ]));
  }

  /* ============================================================
     YEM STATISTIKASI
     ============================================================ */
  function renderFeed() {
    const plan = periodPlan();
    let body;
    if (!plan) {
      body = el('div', { class: 'sl-body-sm sl-text-secondary', text: t('hist.needFish') });
    } else {
      const [fromTs, toTs] = rangeFor(filter);
      const days = Math.max(1, Math.round((toTs - fromTs) / DAY));
      const period = periodFeedTotals(plan, days);
      const feedType = (meta && meta.feed && meta.feed.type) || '';
      const rowsF = [
        ['hist.fd_today', periodFeedTotals(plan, 1)],
        ['hist.fd_week', periodFeedTotals(plan, 7)],
        ['hist.fd_month', periodFeedTotals(plan, 30)],
        ['hist.fd_year', periodFeedTotals(plan, 365)],
        [null, period, `${t('hist.fd_total')} (${days} ${isUz ? 'kun' : 'дн'})`],
      ];
      body = el('div', {}, [
        el('div', { class: 'sl-caption', style: 'margin-bottom:var(--sl-sp-1)',
          text: `${t('hist.meals')}${feedType ? ` · ${t('hist.mealType')}: ${feedType}` : ''}` }),
        el('div', { style: 'display:flex;gap:6px;margin-bottom:var(--sl-sp-2);flex-wrap:wrap' },
          plan.meals.map((m) => el('div', { class: 'sl-sensor', style: '--_c:var(--sl-chart-feed);flex:1;min-height:0;text-align:center;padding:8px 4px' }, [
            el('div', { class: 'sn-lab', style: 'justify-content:center', text: m.time }),
            el('div', { class: 'sn-val', style: 'justify-content:center' }, [
              el('span', { class: 'sl-num', style: 'font-size:15px', text: m.kg.toFixed(1) }),
              el('span', { class: 'sn-unit', text: 'kg' }),
            ]),
          ]))),
        ...rowsF.map(([key, tot, customLabel]) => slKvRow({ icon: 'feed',
          key: customLabel || t(key),
          value: `${tot.kg.toFixed(1)} kg${tot.cost != null ? ` · ${sum(tot.cost)}` : ''}`,
          valueColorVar: customLabel ? '--sl-chart-feed' : null })),
        el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.feedNote') }),
      ]);
    }
    mount(feedStatBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-chart-feed);display:inline-flex', html: slIcon('feed', 18) }),
          el('span', { text: t('hist.feedTitle') }),
        ]),
      ]),
      body,
    ]));
  }

  /* ============================================================
     EKSPORT (SAQLANGAN dynamic import + boyitilgan tarkib)
     ============================================================ */
  function exportRows() {
    return rows.map((r) => ({
      [t('hist.colDate')]: fmtDate(r.ts), [t('hist.colTime')]: fmtTime(r.ts),
      'DO (mg/L)': r.do != null ? +r.do.toFixed(2) : '',
      [`${t('tm.temp')} (°C)`]: r.t != null ? +r.t.toFixed(1) : '',
      pH: r.ph != null ? +r.ph.toFixed(2) : '',
      'TDS (ppm)': r.tds != null ? Math.round(r.tds) : '',
      [t('hist.colStatus')]: statusOf(r.do).label,
    }));
  }
  function statRows() {
    const runMs = aerSamples().length ? aeratorRuntimeMs(aerSamples()) : null;
    const kwh = runMs != null ? kwhOf(runMs) : null;
    const plan = periodPlan();
    const [fromTs, toTs] = rangeFor(filter);
    const days = Math.max(1, Math.round((toTs - fromTs) / DAY));
    const P = t('hist.param'); const V = t('hist.value');
    const energy = [
      { [P]: t('hist.runTime'), [V]: runMs != null ? fmtDur(runMs, isUz) : '—' },
      { [P]: t('hist.consumption'), [V]: kwh != null ? `${kwh.toFixed(2)} kWh` : '—' },
      { [P]: t('hist.cost'), [V]: sum(costOf(kwh)) },
    ];
    const feed = plan ? [
      { [P]: t('hist.fd_today'), [V]: `${plan.dailyKg.toFixed(1)} kg` },
      { [P]: `${t('hist.fd_total')} (${days})`, [V]: `${periodFeedTotals(plan, days).kg.toFixed(1)} kg` },
      { [P]: t('hist.cost'), [V]: sum(periodFeedTotals(plan, days).cost) },
    ] : [];
    return { energy, feed };
  }
  function dl(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function exportCSV() {
    const data = exportRows();
    if (!data.length) return toast(t('hist.noExport'), 'err');
    const head = Object.keys(data[0]);
    const { energy, feed } = statRows();
    const lines = [head.join(';'), ...data.map((r) => head.map((h) => r[h]).join(';')), ''];
    [...energy, ...feed].forEach((r) => lines.push(Object.values(r).join(';')));
    dl(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `smartlake-hisobot-${filter}.csv`);
  }
  async function exportXLSX() {
    const data = exportRows();
    if (!data.length) return toast(t('hist.noExport'), 'err');
    try {
      const XLSX = await import('xlsx');   // SAQLANGAN: faqat bosilganda
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), t('hist.sheetHistory'));
      const { energy, feed } = statRows();
      if (energy.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(energy), t('hist.sheetEnergy'));
      if (feed.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(feed), t('hist.sheetFeed'));
      XLSX.writeFile(wb, `smartlake-hisobot-${filter}.xlsx`);
    } catch (e) { toast('XLSX: ' + (e && e.message), 'err'); }
  }
  async function exportPDF() {
    const data = exportRows();
    if (!data.length) return toast(t('hist.noExport'), 'err');
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const docPdf = new jsPDF();
      const [fromTs, toTs] = rangeFor(filter);
      docPdf.setFontSize(14);
      docPdf.text(`SmartLake — ${t('hist.title')}`, 14, 14);
      docPdf.setFontSize(9);
      docPdf.text(`${fmtDate(fromTs)} — ${fmtDate(toTs)}`, 14, 20);
      autoTable(docPdf, { head: [Object.keys(data[0])], body: data.map((r) => Object.values(r)),
        startY: 25, styles: { fontSize: 7.5 }, headStyles: { fillColor: [14, 124, 107] } });
      const { energy, feed } = statRows();
      const addSection = (title, rows2) => {
        if (!rows2.length) return;
        const y = (docPdf.lastAutoTable ? docPdf.lastAutoTable.finalY : 25) + 8;
        docPdf.setFontSize(11); docPdf.text(title, 14, y);
        autoTable(docPdf, { head: [Object.keys(rows2[0])], body: rows2.map((r) => Object.values(r)),
          startY: y + 3, styles: { fontSize: 8 }, headStyles: { fillColor: [14, 124, 107] } });
      };
      addSection(t('hist.energyTitle'), energy);
      addSection(t('hist.feedTitle'), feed);
      docPdf.save(`smartlake-hisobot-${filter}.pdf`);
    } catch (e) { toast('PDF: ' + (e && e.message), 'err'); }
  }

  /* ============================================================
     MA'LUMOT YUKLASH (SAQLANGAN oqim) + xatolik holati
     ============================================================ */
  function skeletonAll() {
    mount(summaryBox, el('div', { class: 'sl-grid-2' },
      Array.from({ length: 4 }, () => el('div', { class: 'sl-skeleton card', style: 'height:84px;margin:0' }))));
    mount(chartsBox, el('div', { class: 'sl-skeleton card', style: 'height:230px' }));
    mount(tableBox, el('div', { class: 'sl-skeleton card', style: 'height:200px' }));
  }
  function renderError() {
    mount(summaryBox);
    mount(chartsBox);
    mount(tableBox, slCard([slEmptyState({
      icon: 'info', title: t('hist.loadError'),
      desc: navigator.onLine ? '' : t('lakespg.offlineNet'),
      action: slButton({ label: t('hist.retry'), variant: 'secondary', onClick: () => loadData() }),
    })]));
  }
  function renderAll() {
    renderSummary(); renderCharts(); renderTable(); renderEnergy(); renderFeed();
  }

  async function loadData() {
    if (loading) return;
    loading = true; loadFailed = false;
    skeletonAll();
    try {
      const devs = getDevs();
      const ids = devs.map((d) => d.id);
      const [fromTs, toTs] = rangeFor(filter);
      // SAQLANGAN: arxiv + (davr bugunni qamrasa) qurilma 24h buferi, 5-daq dedupe
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
      renderAll();
      if (!firstLoad) toast(t('hist.refreshed'), 'ok');
      firstLoad = false;
    } catch (e) {
      loadFailed = true;
      renderError();
    } finally { loading = false; }
  }

  /* ============================================================
     YIG'ISH + PULL-TO-REFRESH
     ============================================================ */
  const exportRow = el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap;margin-top:var(--sl-sp-2)' }, [
    slButton({ label: 'Excel (.xlsx)', icon: 'download', variant: 'primary', size: 'sm', onClick: exportXLSX }),
    slButton({ label: 'CSV', variant: 'outlined', size: 'sm', onClick: exportCSV }),
    slButton({ label: 'PDF', variant: 'outlined', size: 'sm', onClick: exportPDF }),
  ]);

  const node = el('div', { class: 'sl-stack' }, [
    pullHint,
    slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', text: t('hist.title') }),
        el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('download', 18) }),
      ]),
      filterRow, customRow,
      // LAKEDET-V5: eksport tugmalari YUQORIDA — pastga tushish shart emas
      exportRow,
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)', text: t('hist.exportHint') }),
    ]),
    summaryBox, chartsBox, tableBox, energyBox, feedStatBox,
  ]);

  // Pull-to-refresh (yengil: sahifa tepasida turib pastga tortilsa)
  let pullStartY = null;
  node.addEventListener('touchstart', (e) => {
    pullStartY = (window.scrollY <= 0) ? e.touches[0].clientY : null;
  }, { passive: true });
  node.addEventListener('touchmove', (e) => {
    if (pullStartY == null) return;
    const dy = e.touches[0].clientY - pullStartY;
    pullHint.style.height = dy > 24 ? '20px' : '0';
  }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (pullStartY == null) return;
    const dy = e.changedTouches[0].clientY - pullStartY;
    pullHint.style.height = '0';
    pullStartY = null;
    if (dy > PULL_THRESHOLD && !loading) loadData();
  }, { passive: true });

  // Meta + birinchi ma'lumot (SAQLANGAN tartib)
  loadLakeMeta(lakeId).then((m) => {
    meta = m;
    if (m && m.energy) {
      if (m.energy.kw) kwIn.input.value = m.energy.kw;
      if (m.energy.tariff) tarifIn.input.value = m.energy.tariff;
    }
    if (!loading && !loadFailed) { renderEnergy(); renderFeed(); renderSummary(); }
  }).catch(() => {});
  loadData();

  return node;
}

export default buildHistoryTab;
