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
    const kw = parseFloat(kwIn.input.value) || 0;
    const tariff = parseFloat(tarifIn.input.value) || 0;
    if (!uid) { toast('Foydalanuvchi topilmadi — qayta kiring', 'err'); return; }
    if (!lakeId) { toast('Ko\'l ID topilmadi', 'err'); return; }
    try {
      await saveLakeMeta(lakeId, uid, { energy: { kw, tariff } });
      meta = { ...(meta || {}), energy: { kw, tariff } };
      toast(t('common.saved'), 'ok');
      renderAll();
    } catch (e) {
      const msg = e && e.message || 'Xato';
      toast(msg.includes('permission') ? 'Ruxsat yo\'q — sozlamalar Sozlamalar tabida saqlanadi' : msg, 'err');
    }
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
    } catch (e) {
      // Arxiv o'qishda xato (masalan, ruxsat yo'q) — samples bo'sh qoladi,
      // lekin yem/elektr/moliya meta'dan hisob-lanadi va ko'rsatiladi
      samples = [];
    } finally {
      loading = false;
    }
    renderAll();   // xato bo'lsa ham meta'dan hisoblangan ma'lumotlar ko'rsatiladi
  }

  /* ============================================================
     AI INSIGHT + RISK + KPI + GRAFIKLAR (yangi dizayn)
     ============================================================ */
  const insightBox = el('div');
  const kpiBox     = el('div');
  const chartBox   = el('div');

  function renderInsight() {
    // AI Insight — samples asosida xulosa
    const doVals = samples.filter((x) => typeof x.do === 'number' && x.do > 0).map((x) => x.do);
    const tVals  = samples.filter((x) => typeof x.t === 'number').map((x) => x.t);
    const avgDo  = doVals.length ? doVals.reduce((a, b) => a + b, 0) / doVals.length : null;
    const minDo  = doVals.length ? Math.min(...doVals) : null;
    const avgT   = tVals.length ? tVals.reduce((a, b) => a + b, 0) / tVals.length : null;
    const critCount = doVals.filter((v) => v < 4).length;

    // Xulosa matni
    let insightTitle, insightText, insightColor, insightIcon;
    if (doVals.length === 0) {
      insightTitle = isUz ? "Ma'lumot yetarli emas" : 'Недостаточно данных';
      insightText = isUz ? "Sensor ma'lumotlari topilmadi. Qurilma ulanganini tekshiring." : 'Данные датчиков не найдены.';
      insightColor = '#8aa'; insightIcon = 'info';
    } else if (critCount > 0) {
      insightTitle = isUz ? '⚠ Kislorod muammosi aniqlandi' : '⚠ Обнаружена проблема с кислородом';
      insightText = isUz
        ? `Davrda ${critCount} marta kislorod kritik darajaga tushgan (< 4 mg/L). O'rtacha DO: ${avgDo.toFixed(1)} mg/L. Aerator AUTO rejimida uzluksiz ishlashi tavsiya etiladi.`
        : `Кислород опускался ниже критического ${critCount} раз. Средний DO: ${avgDo.toFixed(1)} мг/л.`;
      insightColor = '#D93025'; insightIcon = 'alert';
    } else if (avgDo != null && avgDo < 5.5) {
      insightTitle = isUz ? 'Kislorod past tendensiya' : 'Низкий тренд кислорода';
      insightText = isUz
        ? `O'rtacha DO ${avgDo.toFixed(1)} mg/L — me'yordan past. Aeratsiya vaqtini ko'paytiring.`
        : `Средний DO ${avgDo.toFixed(1)} мг/л — ниже нормы.`;
      insightColor = '#E8922A'; insightIcon = 'trendDown';
    } else {
      insightTitle = isUz ? 'Barcha ko\'rsatkichlar barqaror' : 'Все показатели стабильны';
      insightText = isUz
        ? `O'rtacha DO: ${avgDo.toFixed(1)} mg/L, Harorat: ${avgT ? avgT.toFixed(1) : '—'}°C. Hozircha muammo yo'q.`
        : `Средний DO: ${avgDo.toFixed(1)}, Темп: ${avgT ? avgT.toFixed(1) : '—'}°C. Проблем нет.`;
      insightColor = '#0E7C6B'; insightIcon = 'check';
    }

    // Risk prognoz
    const riskLevel = critCount > 3 ? 'high' : critCount > 0 ? 'medium' : 'low';
    const riskColor = riskLevel === 'high' ? '#D93025' : riskLevel === 'medium' ? '#E8922A' : '#0E7C6B';
    const riskText = riskLevel === 'high'
      ? (isUz ? 'Yaqin 24 soatda kislorod tanqisligi xavfi YUQORI' : 'Высокий риск дефицита кислорода в ближайшие 24ч')
      : riskLevel === 'medium'
      ? (isUz ? 'O\'rtacha xavf — aeratorni kuzatib boring' : 'Средний риск — следите за аэратором')
      : (isUz ? 'Xavf past — barqaror holat' : 'Низкий риск — стабильное состояние');

    mount(insightBox, el('div', { class: 'sl-stack', style: 'gap:10px' }, [
      // AI Insight Card
      el('div', { style: `background:var(--sl-card,#fff);border-radius:16px;padding:18px;border-left:4px solid ${insightColor};box-shadow:0 1px 6px rgba(0,0,0,.04)` }, [
        el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' }, [
          el('span', { style: `display:inline-flex;color:${insightColor}`, html: slIcon(insightIcon === 'check' ? 'activity' : insightIcon === 'alert' ? 'bell' : 'trendDown', 18) }),
          el('span', { style: `font-size:14px;font-weight:700;color:${insightColor}`, text: insightTitle }),
        ]),
        el('div', { style: 'font-size:13px;line-height:1.55;color:var(--sl-on-surface-variant,#3a5a6a)', text: insightText }),
      ]),
      // Risk Forecast
      el('div', { style: `background:var(--sl-card,#fff);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 1px 4px rgba(0,0,0,.03)` }, [
        el('div', { style: `width:40px;height:40px;border-radius:50%;background:color-mix(in srgb,${riskColor} 12%,transparent);display:flex;align-items:center;justify-content:center;flex:none` }, [
          el('span', { style: `font-size:18px;font-weight:800;color:${riskColor}`, text: riskLevel === 'high' ? '!' : riskLevel === 'medium' ? '~' : '✓' }),
        ]),
        el('div', {}, [
          el('div', { style: 'font-size:11px;font-weight:600;color:var(--sl-text-secondary,#8aa)', text: isUz ? 'Xavf prognozi (24 soat)' : 'Прогноз риска (24ч)' }),
          el('div', { style: `font-size:13px;font-weight:600;color:${riskColor};margin-top:2px`, text: riskText }),
        ]),
      ]),
    ]));
  }

  function renderKpi() {
    const doVals = samples.filter((x) => typeof x.do === 'number' && x.do > 0).map((x) => x.do);
    const tVals  = samples.filter((x) => typeof x.t === 'number').map((x) => x.t);

    function kpiCard(label, value, unit, change, color) {
      return el('div', { style: 'background:var(--sl-card,#fff);border-radius:12px;padding:12px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.03)' }, [
        el('div', { style: 'font-size:10px;font-weight:600;color:var(--sl-text-secondary,#8aa);text-transform:uppercase;letter-spacing:.5px', text: label }),
        el('div', { style: `font-size:22px;font-weight:800;color:${color};line-height:1.2;margin:4px 0 2px`, text: value }),
        unit ? el('div', { style: 'font-size:10px;color:var(--sl-text-disabled,#aaa)', text: unit }) : null,
        change != null ? el('div', { style: `font-size:10px;font-weight:700;color:${change >= 0 ? '#0E7C6B' : '#E8922A'}`, text: `${change >= 0 ? '↑' : '↓'} ${Math.abs(change).toFixed(1)}%` }) : null,
      ].filter(Boolean));
    }

    const avgDo = doVals.length ? doVals.reduce((a,b)=>a+b,0)/doVals.length : null;
    const minDo = doVals.length ? Math.min(...doVals) : null;
    const maxDo = doVals.length ? Math.max(...doVals) : null;
    const avgT  = tVals.length ? tVals.reduce((a,b)=>a+b,0)/tVals.length : null;

    mount(kpiBox, el('div', { style: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:8px 0' }, [
      kpiCard(isUz ? 'O\'rtacha DO' : 'Сред. DO', avgDo != null ? avgDo.toFixed(1) : '—', 'mg/L', null, '#0E7C6B'),
      kpiCard(isUz ? 'Min DO' : 'Мин DO', minDo != null ? minDo.toFixed(1) : '—', 'mg/L', null, minDo != null && minDo < 4 ? '#D93025' : '#E8922A'),
      kpiCard(isUz ? 'Maks DO' : 'Макс DO', maxDo != null ? maxDo.toFixed(1) : '—', 'mg/L', null, '#2A8FC4'),
      kpiCard(isUz ? 'O\'rtacha °C' : 'Сред. °C', avgT != null ? avgT.toFixed(1) : '—', '°C', null, '#E8672A'),
    ]));
  }

  function renderCharts() {
    // DO + Harorat + pH grafiklari
    const W = 300, H = 120;
    function miniChart(data, key, color, label, unit) {
      const vals = data.filter((x) => typeof x[key] === 'number').map((x) => ({ ts: x.ts, v: x[key] }));
      if (!vals.length) return el('div', { style: 'padding:20px;text-align:center;color:var(--sl-text-disabled)', text: isUz ? "Ma'lumot yo'q" : 'Нет данных' });
      const mn = Math.min(...vals.map((x) => x.v)), mx = Math.max(...vals.map((x) => x.v));
      const pad = (mx - mn) * 0.15 || 1;
      const toX = (i) => (i / (vals.length - 1)) * W;
      const toY = (v) => H - 20 - ((v - (mn - pad)) / ((mx + pad) - (mn - pad))) * (H - 30);
      const d = vals.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.v).toFixed(1)}`).join(' ');
      const area = d + ` L${W},${H-20} L0,${H-20}Z`;
      const avg = vals.reduce((a, b) => a + b.v, 0) / vals.length;
      const trend = vals.length > 1 ? vals[vals.length-1].v - vals[0].v : 0;

      return el('div', { style: 'background:var(--sl-card,#fff);border-radius:14px;padding:14px;box-shadow:0 1px 4px rgba(0,0,0,.03);margin-bottom:8px' }, [
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px' }, [
          el('span', { style: 'font-size:13px;font-weight:700;color:var(--sl-on-surface,#1a2a3a)', text: label }),
          el('span', { style: `font-size:11px;font-weight:600;color:${trend >= 0 ? '#0E7C6B' : '#E8922A'}`,
            text: `${trend >= 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(1)} ${unit}` }),
        ]),
        el('div', { html: `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" style="overflow:visible">
          <path d="${area}" fill="${color}" opacity=".08"/>
          <path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          ${vals.filter((_, i) => i % Math.max(1, Math.floor(vals.length / 8)) === 0 || i === vals.length - 1).map((p, _, arr) => {
            const idx = vals.indexOf(p);
            return `<circle cx="${toX(idx).toFixed(1)}" cy="${toY(p.v).toFixed(1)}" r="2.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;
          }).join('')}
        </svg>` }),
        el('div', { style: 'font-size:11px;color:var(--sl-text-secondary,#5a7a8a);margin-top:6px;line-height:1.4',
          text: isUz
            ? `O'rtacha: ${avg.toFixed(1)} ${unit} · Min: ${mn.toFixed(1)} · Maks: ${mx.toFixed(1)} · ${vals.length} o'lchov`
            : `Среднее: ${avg.toFixed(1)} ${unit} · Мин: ${mn.toFixed(1)} · Макс: ${mx.toFixed(1)} · ${vals.length} измерений` }),
      ]);
    }

    mount(chartBox, el('div', { class: 'sl-stack', style: 'gap:8px' }, [
      miniChart(samples, 'do', '#0E7C6B', isUz ? 'Eritilgan kislorod (DO)' : 'Растворённый кислород', 'mg/L'),
      miniChart(samples, 't', '#E8672A', isUz ? 'Harorat' : 'Температура', '°C'),
      miniChart(samples, 'ph', '#2A8FC4', 'pH', ''),
    ]));
  }

  function renderAll() {
    renderInsight(); renderKpi(); renderCharts();
    renderEnergy(); renderFeed(); renderFinance();
  }

  const node = el('div', { class: 'sl-stack' }, [
    // Header + davr + eksport
    el('div', { style: 'background:var(--sl-card,#fff);border-radius:16px;padding:16px;box-shadow:0 1px 6px rgba(0,0,0,.04)' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px' }, [
        el('div', {}, [
          el('div', { style: 'font-size:17px;font-weight:800;color:var(--sl-on-surface,#1a2a3a)', text: isUz ? 'Hisobot va tahlil' : 'Отчёт и аналитика' }),
          el('div', { style: 'font-size:12px;color:var(--sl-text-secondary,#5a7a8a);margin-top:2px', text: lakeName }),
        ]),
        exportToolbar,
      ]),
      dateFilter.node,
    ]),
    // AI Insight + Risk
    insightBox,
    // KPI
    kpiBox,
    // Grafiklar
    chartBox,
    // Elektr / Yem / Moliya
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
