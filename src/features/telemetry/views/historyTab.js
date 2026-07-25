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
  slHistoryChart, slCountUp, slLineChart, slChartLegend,
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
/* Arxivdagi sample'dagi 0 qiymatlarni sensor holati bilan filtrlash:
   DO/pH/TDS/NH3 uchun 0 = sensor mavjud emas (xom arxiv buzilgan
   o'lchov emas, qurilmaning "yo'q" belgisi). Firmware/arxiv
   O'ZGARTIRILMAGAN — faqat displey qatlamida filtrlanadi. */
const ZERO_ABSENT_KEYS = new Set(['do', 'ph', 'tds', 'nh3']);
function cleanSampleVal(key, val) {
  if (val == null || typeof val !== 'number' || !Number.isFinite(val)) return null;
  if (val === 0 && ZERO_ABSENT_KEYS.has(key)) return null;   // 0 = sensor yo'q
  return val;
}
function aggregateLocal(samples, bucketMs) {
  const buckets = new Map();
  for (const sm of samples) {
    const key = Math.floor(sm.ts / bucketMs) * bucketMs;
    let b = buckets.get(key);
    if (!b) { b = { ts: key, n: 0, sdo: 0, ndo: 0, st: 0, nt: 0, sph: 0, nph: 0, stds: 0, ntds: 0 }; buckets.set(key, b); }
    b.n += 1;
    const doV  = cleanSampleVal('do',  sm.do);
    const tV   = cleanSampleVal('t',   sm.t);
    const phV  = cleanSampleVal('ph',  sm.ph);
    const tdsV = cleanSampleVal('tds', sm.tds);
    if (doV  != null) { b.sdo  += doV;  b.ndo  += 1; }
    if (tV   != null) { b.st   += tV;   b.nt   += 1; }
    if (phV  != null) { b.sph  += phV;  b.nph  += 1; }
    if (tdsV != null) { b.stds += tdsV; b.ntds += 1; }
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
        'DO (mg/L)':             cleanSampleVal('do',  sm.do)  != null ? +cleanSampleVal('do',  sm.do).toFixed(2)  : '',
        [`${t('tm.temp')} (°C)`]: cleanSampleVal('t', sm.t) != null ? +cleanSampleVal('t', sm.t).toFixed(1) : '',
        pH:                      cleanSampleVal('ph',  sm.ph)  != null ? +cleanSampleVal('ph',  sm.ph).toFixed(2)  : '',
        'TDS (ppm)':             cleanSampleVal('tds', sm.tds) != null ? Math.round(cleanSampleVal('tds', sm.tds))  : '',
        [t('hist.colStatus')]:   statusOf(cleanSampleVal('do', sm.do)).label,
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

  /* ---------- BITTA KOMBINATSIYALANGAN GRAFIK + DIAPAZON TUGMALARI ---------- */

  // Diapazon: 1h/24h/7d/30d/1y — buildDateFilter'dan mustaqil (tez almashtirish)
  /* ---------- GRAFIK (dateFilter diapazoni, alohida DO/Temp/pH) ---------- */
  function renderCharts() {
    if (!rows.length) {
      mount(chartsBox, slCard([slEmptyState({ icon: 'activity', title: isUz ? "Ma'lumot yo'q" : 'Нет данных' })]));
      return;
    }

    function miniChart(data, key, color, label, unit) {
      const vals = data.filter((x) => typeof x[key] === 'number' && (key !== 'ph' || x[key] > 0)).map((x) => ({ ts: x.ts, v: x[key] }));
      if (!vals.length) return el('div', { style: 'padding:16px;text-align:center;color:var(--sl-text-disabled);font-size:12px', text: isUz ? "Ma'lumot yo'q" : 'Нет данных' });

      const mn = Math.min(...vals.map((x) => x.v)), mx = Math.max(...vals.map((x) => x.v));
      const pad = (mx - mn) * 0.15 || 1;
      const W = 300, H = 100;
      const toX = (i) => (i / Math.max(1, vals.length - 1)) * W;
      const toY = (v) => H - 10 - ((v - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - 20);
      const d = vals.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
      const area = d + ` L${W},${H - 10} L0,${H - 10}Z`;
      const avg = vals.reduce((a, b) => a + b.v, 0) / vals.length;
      const trend = vals.length > 1 ? vals[vals.length - 1].v - vals[0].v : 0;

      const labelCount = Math.min(5, vals.length);
      const step = Math.max(1, Math.floor(vals.length / labelCount));
      const xLabels = [];
      for (let i = 0; i < vals.length; i += step) {
        xLabels.push({ x: toX(i), label: fmtX(vals[i].ts) });
      }

      return el('div', {
        style: 'background:var(--sl-card,#fff);border-radius:14px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,.03)',
      }, [
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, [
          el('div', { style: 'display:flex;align-items:center;gap:6px' }, [
            el('span', { style: `width:10px;height:3px;border-radius:2px;background:${color};display:inline-block` }),
            el('span', { style: 'font-size:13px;font-weight:700;color:var(--sl-on-surface,#1a2a3a)', text: label }),
          ]),
          el('span', { style: `font-size:11px;font-weight:600;color:${trend >= 0 ? '#0E7C6B' : '#E8922A'}`,
            text: `${trend >= 0 ? '\u2191' : '\u2193'} ${Math.abs(trend).toFixed(1)} ${unit}` }),
        ]),
        el('div', { style: 'overflow:visible', innerHTML: `<svg viewBox="0 0 ${W} ${H + 18}" width="100%" height="${H + 18}" style="overflow:visible">
          <path d="${area}" fill="${color}" opacity=".06"/>
          <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          ${vals.filter((_, i) => i % Math.max(1, Math.floor(vals.length / 12)) === 0 || i === vals.length - 1)
            .map((p) => { const idx = vals.indexOf(p); return `<circle cx="${toX(idx).toFixed(1)}" cy="${toY(p.v).toFixed(1)}" r="2.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`; }).join('')}
          ${xLabels.map(({ x, label: lb }) => `<text x="${x.toFixed(1)}" y="${H + 14}" text-anchor="middle" font-size="9" fill="var(--sl-text-disabled,#aaa)" font-family="var(--sl-font-sans,sans-serif)">${lb}</text>`).join('')}
        </svg>` }),
        el('div', { style: 'display:flex;justify-content:space-between;font-size:11px;color:var(--sl-text-secondary,#6a8a9a);margin-top:6px' }, [
          el('span', { text: `Min: ${mn.toFixed(1)}` }),
          el('span', { style: 'font-weight:700', text: `${isUz ? "O'rtacha" : 'Среднее'}: ${avg.toFixed(1)} ${unit}` }),
          el('span', { text: `Max: ${mx.toFixed(1)}` }),
        ]),
      ]);
    }

    mount(chartsBox, el('div', { style: 'display:flex;flex-direction:column;gap:10px' }, [
      miniChart(rows, 'do', '#0E7C6B', isUz ? 'Eritilgan kislorod (DO)' : 'Растворённый кислород', 'mg/L'),
      miniChart(rows, 't', '#E8672A', isUz ? 'Harorat' : 'Температура', '\u00B0C'),
      miniChart(rows, 'ph', '#2A8FC4', 'pH', ''),
    ]));
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
      el('div', { class: 'sl-card-head', style: 'margin-bottom:8px' }, [
        el('div', { class: 'sl-card-title', text: t('hist.tableTitle') }),
        slBadge({ type: 'info', label: String(rows.length), dot: false }),
      ]),
      // Sana oralig'i — jadval ichida ham ko'rinadi
      el('div', { style: 'margin-bottom:10px;padding:8px 12px;border-radius:10px;background:var(--sl-card-inset,#f5f7f8);font-size:12px;color:var(--sl-text-secondary);display:flex;align-items:center;gap:6px' }, [
        el('span', { html: slIcon('calendar', 14), style: 'display:inline-flex;flex:none' }),
        el('span', { text: (() => {
          const [f, to] = dateFilter.getRange();
          const fd = new Date(f), td = new Date(to);
          const fmt = (d) => `${p2(d.getDate())}.${p2(d.getMonth()+1)}.${d.getFullYear()}`;
          return `${fmt(fd)} — ${fmt(td)}`;
        })() }),
        el('button', {
          type: 'button',
          style: 'margin-left:auto;background:none;border:none;color:var(--sl-primary);font-size:11px;font-weight:600;cursor:pointer;text-decoration:underline',
          text: isUz ? 'Oralikni o\'zgartirish ↑' : 'Изменить период ↑',
          onClick: () => {
            // Sahifa yuqorisidagi dateFilter ga scroll qilish
            dateFilter.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
          },
        }),
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
      // 24h bufer — arxivsiz ham ishlaydi
      let rtdb = [];
      if (ids.length) {
        const pts = await historyService.getHistory(ids[0], '24h').catch(() => []);
        rtdb = pts.filter((x) => x.ts >= fromTs && x.ts <= toTs);
      }
      // Arxiv — xato bo'lsa jim o'tkaziladi, bufer yetarli bo'ladi
      let arch = [];
      try {
        const _r = authStore.getState().role;
        arch = await fetchArchive(uid, ids, fromTs, toTs, _r === 'super' || _r === 'operator' || _r === 'region');
      } catch (_) {}
      const seen = new Set(arch.map((x) => Math.floor(x.ts / 300e3)));
      samples = arch.concat(rtdb.filter((x) => !seen.has(Math.floor(x.ts / 300e3))))
        .sort((a, b) => a.ts - b.ts);
      rows = aggregateLocal(samples, bucketFor(toTs - fromTs));
    } catch (e) {
      // Arxiv xatosi — 24h buferdan kelgan ma'lumotlar saqlanadi
      samples = samples.length ? samples : [];
      rows = aggregateLocal(samples, bucketFor(toTs - fromTs));
    } finally { loading = false; }
    renderSummary(); renderCharts(); renderTable();
    if (!firstLoad) toast(t('hist.refreshed'), 'ok');
    firstLoad = false;
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
