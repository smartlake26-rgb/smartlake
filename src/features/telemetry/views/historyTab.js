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
  const RANGES = [
    { id: '1h',  labelUz: '1 soat',  labelRu: '1 час',   ms: 3600e3 },
    { id: '24h', labelUz: '24 soat', labelRu: '24 часа', ms: 24*3600e3 },
    { id: '7d',  labelUz: '7 kun',   labelRu: '7 дней',  ms: 7*24*3600e3 },
    { id: '30d', labelUz: '30 kun',  labelRu: '30 дней', ms: 30*24*3600e3 },
    { id: '1y',  labelUz: '1 yil',   labelRu: '1 год',   ms: 365*24*3600e3 },
  ];
  let activeRange = '24h';
  const rangeBtns = new Map();
  const chartFrame = el('div', { style: 'min-height:240px' });

  function getChartLabel(r) { return isUz ? r.labelUz : r.labelRu; }

  /* Faqat MAVJUD ma'lumot ichida ko'rsatish:
     rows'dagi birinchi va oxirgi ts orasidagi diapazonni hisoblaymiz,
     tanlangan diapazon bu chegaradan o'tmasin. */
  function rangePoints() {
    if (!rows.length) return [];
    const rDef = RANGES.find((r) => r.id === activeRange) || RANGES[1];
    const lastTs = rows[rows.length - 1].ts;
    const cutoff = lastTs - rDef.ms;
    // Kamida bitta nuqta borligiga kafolat
    const filtered = rows.filter((r) => r.ts >= cutoff);
    return filtered.length ? filtered : rows;
  }

  function fmtXRange(ts) {
    const rDef = RANGES.find((r) => r.id === activeRange) || RANGES[1];
    if (rDef.ms <= 24 * 3600e3) return fmtTime(ts);
    if (rDef.ms <= 7 * 24 * 3600e3)
      return `${p2(new Date(ts).getDate())}.${p2(new Date(ts).getMonth()+1)} ${fmtTime(ts)}`;
    return `${p2(new Date(ts).getDate())}.${p2(new Date(ts).getMonth()+1)}`;
  }

  /* Inline SVG grafik — chiziq + nuqtalar, 3 seriya, chiroyli */
  function drawChart() {
    const th = getTh();
    const pts = rangePoints();

    if (!pts.length) {
      mount(chartFrame, el('div', { style: 'display:flex;align-items:center;justify-content:center;height:240px;color:var(--sl-text-disabled);flex-direction:column;gap:8px' }, [
        el('div', { html: slIcon('activity', 32), style: 'opacity:.25' }),
        el('div', { text: isUz ? "Ma'lumot yo'q" : 'Нет данных' }),
      ]));
      return;
    }

    const W = 340, H = 200, PAD = { t: 12, r: 8, b: 32, l: 38 };
    const IW = W - PAD.l - PAD.r, IH = H - PAD.t - PAD.b;

    // Har seriya uchun range
    const series = [
      { key: 'do',   color: 'var(--sl-chart-do)',   label: 'DO', unit: 'mg/L' },
      { key: 't',    color: 'var(--sl-chart-temp)',  label: isUz ? 'Harorat' : 'Темп.', unit: '°C' },
      { key: 'ph',   color: 'var(--sl-chart-ph)',    label: 'pH', unit: '' },
    ];

    // Normalize: har seriya 0..1 ga siqish (turli birliklar bitta grafikda)
    const ranges = {};
    series.forEach(({ key }) => {
      const vals = pts.map((p) => p[key]).filter((v) => typeof v === 'number');
      if (!vals.length) { ranges[key] = null; return; }
      const mn = Math.min(...vals), mx = Math.max(...vals);
      const pad = (mx - mn) * 0.1 || 1;
      ranges[key] = { min: mn - pad, max: mx + pad };
    });

    // X o'qi: tanlangan diapazonning BOSHIDAN OXIRIGACHA (now gacha)
    // Shunda 1s tanlasang nuqtalar x o'qini to'liq egallaydi,
    // 24s tanlasang 1s ma'lumot x o'qning faqat o'ng 1/24 qismida turadi
    const rDef2 = RANGES.find((r) => r.id === activeRange) || RANGES[1];
    const xMax = Date.now();
    const xMin = xMax - rDef2.ms;
    const xRange = rDef2.ms;
    const toX = (ts) => PAD.l + Math.max(0, Math.min(1, (ts - xMin) / xRange)) * IW;
    const toY = (v, key) => {
      const r = ranges[key]; if (!r) return null;
      return PAD.t + IH - ((v - r.min) / (r.max - r.min)) * IH;
    };

    // X o'qi yorliqlari — to'liq diapazon bo'yicha 5 ta bir xil oraliqda
    const labelCount = 5;
    const xLabels = Array.from({ length: labelCount + 1 }, (_, i) => {
      const ts = xMin + (rDef2.ms / labelCount) * i;
      return { x: toX(ts), label: fmtXRange(ts) };
    });

    // Har seriya uchun path + circles
    const seriesSvg = series.map(({ key, color }) => {
      if (!ranges[key]) return '';
      const valid = pts.filter((p) => typeof p[key] === 'number');
      if (!valid.length) return '';
      // Chiziq
      const d = valid.map((p, i) => `${i ? 'L' : 'M'}${toX(p.ts).toFixed(1)},${toY(p[key], key).toFixed(1)}`).join(' ');
      // Nuqtalar
      const dots = valid.map((p) => `<circle cx="${toX(p.ts).toFixed(1)}" cy="${toY(p[key], key).toFixed(1)}" r="3" fill="${color}" stroke="#fff" stroke-width="1.5"/>`).join('');
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    }).join('');

    // DO kritik chiziq
    const critY = ranges['do'] ? toY(th.do.crit, 'do') : null;
    const critLine = critY != null
      ? `<line x1="${PAD.l}" y1="${critY.toFixed(1)}" x2="${PAD.l+IW}" y2="${critY.toFixed(1)}" stroke="var(--sl-critical)" stroke-width="1" stroke-dasharray="4,3" opacity=".6"/>`
      : '';

    // Grid gorizontal chiziqlar
    const gridLines = [0.25, 0.5, 0.75].map((f) => {
      const y = (PAD.t + IH * (1 - f)).toFixed(1);
      return `<line x1="${PAD.l}" y1="${y}" x2="${PAD.l+IW}" y2="${y}" stroke="var(--sl-divider)" stroke-width="0.5"/>`;
    }).join('');

    const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
      style="width:100%;height:${H}px;overflow:visible">
      ${gridLines}
      <line x1="${PAD.l}" y1="${PAD.t}" x2="${PAD.l}" y2="${PAD.t+IH}" stroke="var(--sl-divider)" stroke-width="1"/>
      <line x1="${PAD.l}" y1="${PAD.t+IH}" x2="${PAD.l+IW}" y2="${PAD.t+IH}" stroke="var(--sl-divider)" stroke-width="1"/>
      ${critLine}
      ${seriesSvg}
      ${xLabels.map(({ x, label }) =>
        `<text x="${x.toFixed(1)}" y="${H - 4}" text-anchor="middle" font-size="9" fill="var(--sl-text-secondary)" font-family="var(--sl-font-sans,sans-serif)">${label}</text>`
      ).join('')}
    </svg>`;

    // Legend
    const legend = el('div', { style: 'display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;padding:0 4px' },
      series.filter(({ key }) => ranges[key]).map(({ color, label, unit }) =>
        el('div', { style: 'display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sl-text-secondary)' }, [
          el('span', { style: `width:20px;height:3px;border-radius:2px;background:${color};display:inline-block` }),
          el('span', { text: unit ? `${label} (${unit})` : label }),
        ])));

    mount(chartFrame, el('div', { style: 'padding:4px 0' }, [
      el('div', { html: svg, style: 'overflow:visible' }),
      legend,
    ]));
  }

  function renderCharts() {
    const rangeRow = el('div', { style: 'display:flex;gap:5px;flex-wrap:wrap;margin-bottom:var(--sl-sp-3)' },
      RANGES.map((r) => {
        const active = r.id === activeRange;
        const btn = el('button', {
          type: 'button',
          style: `padding:4px 12px;border-radius:20px;border:1.5px solid;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;`
               + (active
                 ? 'background:var(--sl-primary);color:#fff;border-color:var(--sl-primary)'
                 : 'background:transparent;color:var(--sl-text-secondary);border-color:var(--sl-border)'),
          text: getChartLabel(r),
        });
        btn.addEventListener('click', () => {
          activeRange = r.id;
          rangeBtns.forEach((b, id) => {
            const a = id === activeRange;
            b.style.background = a ? 'var(--sl-primary)' : 'transparent';
            b.style.color = a ? '#fff' : 'var(--sl-text-secondary)';
            b.style.borderColor = a ? 'var(--sl-primary)' : 'var(--sl-border)';
          });
          drawChart();
        });
        rangeBtns.set(r.id, btn);
        return btn;
      }));

    drawChart();

    mount(chartsBox, slCard([
      el('div', { class: 'sl-card-head', style: 'margin-bottom:var(--sl-sp-2)' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { html: slIcon('activity', 16), style: 'display:inline-flex;color:var(--sl-primary)' }),
          el('span', { text: isUz ? 'DO · Harorat · pH' : 'DO · Темп. · pH' }),
        ]),
      ]),
      rangeRow,
      chartFrame,
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
      // 24h bufer — arxivsiz ham ishlaydi
      let rtdb = [];
      if (ids.length) {
        const pts = await historyService.getHistory(ids[0], '24h').catch(() => []);
        rtdb = pts.filter((x) => x.ts >= fromTs && x.ts <= toTs);
      }
      // Arxiv — xato bo'lsa jim o'tkaziladi, bufer yetarli bo'ladi
      let arch = [];
      try { arch = await fetchArchive(uid, ids, fromTs, toTs); } catch (_) {}
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
