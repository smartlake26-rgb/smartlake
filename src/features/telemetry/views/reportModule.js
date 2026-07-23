// ============================================================
//  features/telemetry/views/reportModule.js — HISOBOT MODULI v1
//  (REP-V1) Tarix sahifasidan KO'CHIRILGAN bo'limlar shu yerda:
//  ELEKTR ENERGIYASI (davr/bugun/hafta/oy, kW-tarif kiritish,
//  aeratorlar kesimi, kunlik kWh grafigi) + YEM STATISTIKASI
//  (kunlik/haftalik/oylik/yillik/davr, ovqat vaqtlari, kunlik kg
//  grafigi) + MOLIYAVIY xulosa (elektr + yem xarajati) + eksport.
//  Hech qanday funksiya YO'QOLMAGAN — faqat joyi o'zgargan.
//
//  Reusable: buildDateFilter, buildExportToolbar, slBarChart,
//  slKvRow, slCard. Ma'lumot oqimi Tarix bilan bir xil (fetchArchive
//  ∪ 24h bufer) — servislar O'ZGARTIRILMAGAN.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { historyService } from '../services/historyService.js';
import {
  fetchArchive, aeratorRuntimeMs, loadLakeMeta, saveLakeMeta,
} from '../services/archiveService.js';
import { computeFeedPlan, periodFeedTotals } from '../domain/feedEngine.js';
import { buildDateFilter } from '../components/dateFilter.js';
import { buildExportToolbar } from '../components/exportToolbar.js';
import {
  slIcon, slCard, slButton, slBadge, slField, slKvRow, slEmptyState,
  slBarChart,
} from '../../../design-system/index.js';

const DAY = 24 * 3600e3;
const p2 = (n) => String(n).padStart(2, '0');
const fmtDate = (ts) => { const d = new Date(ts); return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`; };
function fmtDur(ms, isUz) {
  const m = Math.round(ms / 60000); const h = Math.floor(m / 60);
  return h > 0 ? `${h} ${isUz ? 'soat' : 'ч'} ${m % 60} ${isUz ? 'daq' : 'мин'}` : `${m} ${isUz ? 'daq' : 'мин'}`;
}
const avgArr = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

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
 * @param {{lakeId, uid, isUz, getDevs, lakeName?:string}} p
 */
export function buildReportTab({ lakeId, uid, isUz, getDevs, lakeName = '' }) {
  let samples = [];
  let meta = null;
  let loading = false;

  const sum = (v) => (v != null ? `${Math.round(v).toLocaleString()} ${isUz ? "so'm" : 'сум'}` : '—');
  const dateFilter = buildDateFilter({ initial: 'oy', onChange: () => loadData() });

  /* ---------- elektr yordamchilari (Tarixdan ko'chirilgan mantiq) ---------- */
  const kwIn = slField({ type: 'number', label: t('hist.kw'), attrs: { min: '0', step: '0.1' }, placeholder: '1.5' });
  const tarifIn = slField({ type: 'number', label: t('hist.tariff'), attrs: { min: '0', step: '1' }, placeholder: '1000' });
  [kwIn, tarifIn].forEach((f) => { f.querySelector('.sl-help').remove(); f.style.flex = '1'; f.style.minWidth = '120px'; });
  const kwTotal = () => parseFloat(kwIn.input.value) || (meta && meta.energy && meta.energy.kw) || 0;
  const tariffVal = () => parseFloat(tarifIn.input.value) || (meta && meta.energy && meta.energy.tariff) || 0;
  const kwhOf = (ms) => { const kw = kwTotal(); return kw ? (ms / 3600e3) * kw : null; };
  const costOf = (kwh) => { const tf = tariffVal(); return kwh != null && tf ? Math.round(kwh * tf) : null; };
  const aerSamples = () => samples.filter((x) => 'aer' in x);
  function runSince(cutoff) {
    const [fromTs] = dateFilter.getRange();
    if (fromTs > cutoff) return null;
    return aeratorRuntimeMs(aerSamples().filter((x) => x.ts >= cutoff));
  }
  const saveEnergyBtn = slButton({ label: t('common.save'), variant: 'secondary', onClick: async () => {
    const kw = parseFloat(kwIn.input.value) || 0; const tariff = parseFloat(tarifIn.input.value) || 0;
    try {
      await saveLakeMeta(lakeId, uid, { energy: { kw, tariff } });   // SAQLANGAN yozuv yo'li
      meta = { ...(meta || {}), energy: { kw, tariff } };
      toast(t('common.saved'), 'ok');
      renderAll();
    } catch (e) { toast((e && e.message) || 'Xato', 'err'); }
  } });

  /* ---------- yem yordamchilari ---------- */
  function periodPlan() {
    if (!meta) return null;
    const temps = samples.map((x) => x.t).filter((v) => typeof v === 'number');
    return computeFeedPlan({ fish: meta.fish || [], feed: meta.feed || {}, tempC: avgArr(temps) });
  }
  function periodDays() {
    const [f, to] = dateFilter.getRange();
    return Math.max(1, Math.round((to - f) / DAY));
  }
  function dailyEnergyBars() {
    return byDay(aerSamples()).map(({ dayTs, samples: ds }) => {
      const kwh = kwhOf(aeratorRuntimeMs(ds));
      return { label: `${p2(new Date(dayTs).getDate())}.${p2(new Date(dayTs).getMonth() + 1)}`,
        value: kwh != null ? +kwh.toFixed(2) : +(aeratorRuntimeMs(ds) / 3600e3).toFixed(2), key: 'energy' };
    });
  }
  function dailyFeedBars() {
    if (!meta) return [];
    return byDay(samples).map(({ dayTs, samples: ds }) => {
      const plan = computeFeedPlan({ fish: meta.fish || [], feed: meta.feed || {},
        tempC: avgArr(ds.map((x) => x.t).filter((v) => typeof v === 'number')) });
      return { label: `${p2(new Date(dayTs).getDate())}.${p2(new Date(dayTs).getMonth() + 1)}`,
        value: plan ? +plan.dailyKg.toFixed(1) : 0, key: 'feed' };
    });
  }

  /* ---------- EKSPORT (elektr + yem + moliya, to'liq) ---------- */
  const exportToolbar = buildExportToolbar({
    getFileBase: () => `smartlake-hisobot-${dateFilter.getId()}`,
    getTitle: () => {
      const [f, to] = dateFilter.getRange();
      return `SmartLake — ${t('reports.title')} · ${lakeName || lakeId} · ${fmtDate(f)}–${fmtDate(to)}`;
    },
    getSheets: () => {
      const P = t('hist.param'); const V = t('hist.value');
      const runMs = aerSamples().length ? aeratorRuntimeMs(aerSamples()) : null;
      const kwh = runMs != null ? kwhOf(runMs) : null;
      const plan = periodPlan();
      const days = periodDays();
      const feedTot = plan ? periodFeedTotals(plan, days) : null;
      const energy = [
        { [P]: t('hist.runTime'), [V]: runMs != null ? fmtDur(runMs, isUz) : '—' },
        { [P]: t('hist.consumption'), [V]: kwh != null ? `${kwh.toFixed(2)} kWh` : '—' },
        { [P]: t('hist.cost'), [V]: sum(costOf(kwh)) },
      ];
      const feed = plan ? [
        { [P]: t('hist.fd_today'), [V]: `${plan.dailyKg.toFixed(1)} kg` },
        { [P]: `${t('hist.fd_total')} (${days})`, [V]: `${feedTot.kg.toFixed(1)} kg` },
        { [P]: t('hist.cost'), [V]: sum(feedTot.cost) },
      ] : [];
      const fin = [{
        [P]: t('rep.finTotal'),
        [V]: sum((costOf(kwh) || 0) + ((feedTot && feedTot.cost) || 0)),
      }];
      return [
        { name: t('hist.sheetEnergy'), rows: energy },
        { name: t('hist.sheetFeed'), rows: feed },
        { name: t('rep.finance'), rows: fin },
      ];
    },
  });

  /* ---------- konteynerlar ---------- */
  const energyBox = el('div');
  const feedBox = el('div');
  const finBox = el('div');

  function renderEnergy() {
    const hasAer = aerSamples().length > 0;
    const runMs = hasAer ? aeratorRuntimeMs(aerSamples()) : null;
    const kwh = runMs != null ? kwhOf(runMs) : null;
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const periodRows = [
      ['hist.e_today', runSince(startToday.getTime())],
      ['hist.e_week', runSince(now - 7 * DAY)],
      ['hist.e_month', runSince(now - 30 * DAY)],
      ['hist.e_total', runMs],
    ].map(([key, ms]) => {
      const k2 = ms != null ? kwhOf(ms) : null;
      return slKvRow({ icon: 'zap', key: t(key),
        value: ms == null ? `— (${t('hist.widen')})`
          : k2 != null ? `${k2.toFixed(2)} kWh · ${sum(costOf(k2))}` : fmtDur(ms, isUz),
        valueColorVar: ms == null ? '--sl-text-disabled' : '--sl-chart-energy' });
    });

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
            key: `${t('hist.aerN')} ${i + 1}${kwEach ? ` · ${kwEach} kW` : ''}`,
            value: `${fmtDur(ms, isUz)}${k2 != null ? ` · ${k2.toFixed(2)} kWh · ${sum(costOf(k2))}` : ''}` });
        }),
      ]);
    } else {
      perAer = el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.needAer') });
    }

    const bars = dailyEnergyBars();
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
      bars.length ? el('div', { class: 'sl-chart-frame', style: 'margin-top:var(--sl-sp-3)' }, [
        slBarChart({ bars, height: 180, unit: 'kWh', ariaLabel: t('hist.chart_energyDaily') }),
      ]) : null,
      el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.energyNote') }),
    ].filter(Boolean)));
  }

  function renderFeed() {
    const plan = periodPlan();
    let body;
    if (!plan) {
      body = el('div', { class: 'sl-body-sm sl-text-secondary', text: t('hist.needFish') });
    } else {
      const days = periodDays();
      const period = periodFeedTotals(plan, days);
      const feedType = (meta && meta.feed && meta.feed.type) || '';
      const bars = dailyFeedBars();
      body = el('div', {}, [
        el('div', { class: 'sl-caption', style: 'margin-bottom:var(--sl-sp-1)',
          text: `${t('hist.meals')}${feedType ? ` · ${t('hist.mealType')}: ${feedType}` : ''}` }),
        el('div', { style: 'display:flex;gap:6px;margin-bottom:var(--sl-sp-2);flex-wrap:wrap' },
          plan.meals.map((m) => el('span', { class: 'sl-badge neutral',
            style: 'font-variant-numeric:tabular-nums', text: `${m.time} — ${m.kg.toFixed(1)} kg` }))),
        ...[
          ['hist.fd_today', periodFeedTotals(plan, 1)],
          ['hist.fd_week', periodFeedTotals(plan, 7)],
          ['hist.fd_month', periodFeedTotals(plan, 30)],
          ['hist.fd_year', periodFeedTotals(plan, 365)],
          [null, period, `${t('hist.fd_total')} (${days} ${isUz ? 'kun' : 'дн'})`],
        ].map(([key, tot, customLabel]) => slKvRow({ icon: 'feed',
          key: customLabel || t(key),
          value: `${tot.kg.toFixed(1)} kg${tot.cost != null ? ` · ${sum(tot.cost)}` : ''}`,
          valueColorVar: customLabel ? '--sl-chart-feed' : null })),
        bars.length ? el('div', { class: 'sl-chart-frame', style: 'margin-top:var(--sl-sp-3)' }, [
          slBarChart({ bars, height: 180, unit: 'kg', ariaLabel: t('hist.chart_feedDaily') }),
        ]) : null,
        el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)', text: t('hist.feedNote') }),
      ].filter(Boolean));
    }
    mount(feedBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-chart-feed);display:inline-flex', html: slIcon('feed', 18) }),
          el('span', { text: t('hist.feedTitle') }),
        ]),
      ]),
      body,
    ]));
  }

  function renderFinance() {
    const runMs = aerSamples().length ? aeratorRuntimeMs(aerSamples()) : null;
    const eCost = costOf(runMs != null ? kwhOf(runMs) : null);
    const plan = periodPlan();
    const fCost = plan ? periodFeedTotals(plan, periodDays()).cost : null;
    const total = (eCost || 0) + (fCost || 0);
    mount(finBox, slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('trendUp', 18) }),
          el('span', { text: t('rep.finance') }),
        ]),
        slBadge({ type: 'info', dot: false, label: `${periodDays()} ${isUz ? 'kun' : 'дн'}` }),
      ]),
      slKvRow({ icon: 'zap', key: t('hist.energyTitle'), value: sum(eCost), valueColorVar: '--sl-chart-energy' }),
      slKvRow({ icon: 'feed', key: t('hist.feedTitle'), value: sum(fCost), valueColorVar: '--sl-chart-feed' }),
      slKvRow({ icon: 'trendUp', key: t('rep.finTotal'),
        value: (eCost != null || fCost != null) ? sum(total) : '—', valueColorVar: '--sl-primary' }),
    ]));
  }

  function renderAll() { renderEnergy(); renderFeed(); renderFinance(); }
  function skeletonAll() {
    mount(energyBox, el('div', { class: 'sl-skeleton card', style: 'height:220px' }));
    mount(feedBox, el('div', { class: 'sl-skeleton card', style: 'height:180px' }));
    mount(finBox, el('div', { class: 'sl-skeleton card', style: 'height:110px' }));
  }
  function renderError() {
    mount(energyBox, slCard([slEmptyState({
      icon: 'info', title: t('hist.loadError'),
      desc: navigator.onLine ? '' : t('lakespg.offlineNet'),
      action: slButton({ label: t('hist.retry'), variant: 'secondary', onClick: () => loadData() }),
    })]));
    mount(feedBox); mount(finBox);
  }

  async function loadData() {
    if (loading) return;
    loading = true;
    skeletonAll();
    try {
      const ids = getDevs().map((d) => d.id);
      const [fromTs, toTs] = dateFilter.getRange();
      const arch = await fetchArchive(uid, ids, fromTs, toTs);
      let rtdb = [];
      if (toTs >= Date.now() - DAY && ids.length) {
        const pts = await historyService.getHistory(ids[0], '24h').catch(() => []);
        rtdb = pts.filter((x) => x.ts >= fromTs && x.ts <= toTs);
      }
      const seen = new Set(arch.map((x) => Math.floor(x.ts / 300e3)));
      samples = arch.concat(rtdb.filter((x) => !seen.has(Math.floor(x.ts / 300e3))))
        .sort((a, b) => a.ts - b.ts);
      renderAll();
    } catch (e) { renderError(); }
    finally { loading = false; }
  }

  const node = el('div', { class: 'sl-stack' }, [
    slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', {}, [
          el('div', { class: 'sl-card-title', text: t('reports.title') }),
          el('div', { class: 'sl-caption', text: `${lakeName} · ${t('rep.scope')}` }),
        ]),
        el('span', { style: 'color:var(--sl-primary);display:inline-flex', html: slIcon('download', 18) }),
      ]),
      dateFilter.node,
      el('div', { style: 'margin-top:var(--sl-sp-2)' }, [exportToolbar]),
    ]),
    energyBox, feedBox, finBox,
  ]);

  loadLakeMeta(lakeId).then((m) => {
    meta = m || null;
    if (m && m.energy) {
      if (m.energy.kw) kwIn.input.value = m.energy.kw;
      if (m.energy.tariff) tarifIn.input.value = m.energy.tariff;
    }
    if (!loading) renderAll();
  }).catch(() => {});
  loadData();

  return node;
}

export default buildReportTab;
