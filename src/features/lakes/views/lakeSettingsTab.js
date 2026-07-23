// ============================================================
//  features/lakes/views/lakeSettingsTab.js — SOZLAMALAR v3
//  (SETT-V3, Design System 3.0)
//
//  Tartib (topshiriq bo'yicha):
//    1. Qurilmalar (devicesCard — tashqaridan uzatiladi)
//    2. Ko'l pasporti
//    3. Baliq turlari (katalogdan; stockedAt olib tashlandi)
//    4. Yem (katalogdan; fermer faqat tur + narx)
//    5. Aeratorlar (faqat soni + kW; model yo'q)
//    6. Elektr narxi (tarif aeratordan ajralib alohida karta)
//
//  Biomassa: faqat feedBasedGrowth=true baliqlar uchun
//  (katalog parametri bo'yicha, nom bo'yicha emas).
//  Elektr tarifi: Sozlamalarda saqlanadi, Hisobot o'qiydi.
//
//  SAQLANGAN: buildLakeSettingsTab imzosi, saveLakeMeta
//  yozuv yo'li, eski erkin-matn yozuvlar "(eski yozuv)".
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { loadLakeMeta, saveLakeMeta } from '../../telemetry/services/archiveService.js';
import { biomassKg } from '../../telemetry/domain/feedEngine.js';
import { estimateAvgWeightG } from '../../telemetry/domain/growth.js';
import { loadCatalogs, catalogName } from '../../catalog/catalogService.js';
import { slIcon, slCard, slButton, slField, slSelect, slKvRow } from '../../../design-system/index.js';

const MAX_FISH = 4;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const numOrNull = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const fmt = (key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), t(key));

/**
 * @param {object} p
 * @param {string}       p.lakeId
 * @param {string}       p.uid
 * @param {boolean}      p.isUz
 * @param {HTMLElement}  p.devicesCard  — Qurilmalar kartasi (tashqaridan uzatiladi)
 * @param {Function}     [p.onSaved]
 */
export function buildLakeSettingsTab({ lakeId, uid, isUz, devicesCard, onSaved }) {
  let meta = null;
  let fish = [];
  let catalogs = { fish: [], feed: [] };

  /* --- Yordamchilar --- */
  const secTitle = (ic, txt, colorVar = '--sl-primary') =>
    el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px;margin-bottom:var(--sl-sp-3)' }, [
      el('span', { html: slIcon(ic, 17), style: `color:var(${colorVar});display:inline-flex` }),
      el('span', { text: txt }),
    ]);

  function field(label, opts = {}) {
    const f = slField({
      label, type: opts.type || 'number',
      attrs: opts.attrs || { min: '0', step: opts.step || '1' },
      placeholder: opts.ph,
    });
    f.querySelector('.sl-help').remove();
    f.style.flex = '1'; f.style.minWidth = opts.minW || '120px';
    return f;
  }

  async function save(patch, okMsg) {
    try {
      await saveLakeMeta(lakeId, uid, patch);
      meta = { ...(meta || {}), ...patch };
      toast(okMsg || t('common.saved'), 'ok');
      if (onSaved) onSaved(meta);
    } catch (e) { toast((e && e.message) || 'Xato', 'err'); }
  }

  /* ============================================================
     1 · KO'L PASPORTI
     ============================================================ */
  const areaIn    = field(t('lset.area'),     { step: '0.01', ph: '1.5' });
  const avgDepthIn= field(t('lset.avgDepth'), { step: '0.1',  ph: '1.8' });
  const maxDepthIn= field(t('lset.maxDepth'), { step: '0.1',  ph: '3.0' });

  const passportCard = slCard([
    secTitle('droplet', t('lset.passport')),
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap;align-items:flex-end' },
      [areaIn, avgDepthIn, maxDepthIn]),
    el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
      slButton({ label: t('common.save'), variant: 'secondary', onClick: () =>
        save({ passport: {
          area:     numOrNull(areaIn.input.value),
          avgDepth: numOrNull(avgDepthIn.input.value),
          maxDepth: numOrNull(maxDepthIn.input.value),
        } }),
      }),
    ]),
  ]);

  /* ============================================================
     2 · BALIQ TURLARI (katalogdan)
     ============================================================ */
  const fishList = el('div');
  const biomassEl = el('div', {
    class: 'sl-body-sm',
    style: 'font-weight:800;color:var(--sl-primary);font-variant-numeric:tabular-nums;margin-top:var(--sl-sp-2)',
  });

  function refreshBiomass() {
    // Faqat feedBasedGrowth=true baliqlar biomassaga kiradi
    const fbFish = fish.filter((f) => {
      const cat = catalogs.fish.find((c) => c.id === f.typeId);
      return !cat || cat.feedBasedGrowth !== false;
    });
    const bm = biomassKg(fbFish);
    biomassEl.textContent = `${t('lset.biomass')}: ${bm > 0 ? bm.toFixed(1) + ' kg' : '—'}`;
  }

  function fishCatItem(f) {
    return catalogs.fish.find((c) => c.id === f.typeId) || null;
  }

  function fishRow(f, idx) {
    /* Katalog dropdown */
    const opts = [
      { value: '', label: t('lset.pickType') },
      ...catalogs.fish.map((c) => ({ value: c.id, label: catalogName(c, isUz) })),
    ];
    if (!f.typeId && f.type) opts.push({ value: '_legacy', label: `${f.type} ${t('lset.legacy')}` });
    const typeSel = slSelect(opts, f.typeId || (f.type ? '_legacy' : ''));

    const countIn = field(t('lset.count'));             countIn.input.value = f.count ?? '';
    const swIn    = field(t('lset.startW'), { ph:'g' }); swIn.input.value  = f.startWeight ?? '';
    const awIn    = field(t('lset.avgW'),   { ph:'g' }); awIn.input.value  = f.avgWeight ?? '';

    /* Taxminiy joriy vazn — faqat feedBasedGrowth=true bo'lsa */
    const estBox = el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)' });
    function refreshEst() {
      const cat = fishCatItem(f);
      estBox.replaceChildren();
      if (!cat) return;
      // KATALOG PARAMETRI bo'yicha (nom bo'yicha emas)
      if (cat.feedBasedGrowth === false) {
        estBox.textContent = t('lset.noGrowth');
        return;
      }
      const est = estimateAvgWeightG({
        startWeightG: num(swIn.input.value),
        stockedAtTs: null,   // stockedAt olib tashlandi — null
        fcr: cat.fcr,
      });
      if (est == null) { estBox.textContent = t('lset.estHint'); return; }
      mount(estBox,
        el('span', { text: `${t('lset.estW')}: ~${est} g ` }),
        slButton({ label: t('lset.apply'), variant: 'text', size: 'sm', onClick: () => {
          awIn.input.value = est; f.avgWeight = est; refreshBiomass();
        } }));
    }

    typeSel.addEventListener('change', () => {
      f.typeId = typeSel.value === '_legacy' ? null : (typeSel.value || null);
      if (f.typeId) f.type = catalogName(fishCatItem(f), isUz);
      refreshEst();
    });
    countIn.input.addEventListener('input', () => { f.count = numOrNull(countIn.input.value); refreshBiomass(); });
    swIn.input.addEventListener('input',    () => { f.startWeight = numOrNull(swIn.input.value); refreshEst(); });
    awIn.input.addEventListener('input',    () => { f.avgWeight   = numOrNull(awIn.input.value); refreshBiomass(); });

    /* O'lim korreksiyasi */
    const deadIn = field(t('lset.dead'), { ph: '0', minW: '90px' });
    deadIn.style.maxWidth = '120px';
    const deadBtn = slButton({ label: t('lset.deadBtn'), variant: 'outlined', size: 'sm', onClick: () => {
      const d = num(deadIn.input.value);
      if (d <= 0) return toast(t('lset.enterNum'), 'err');
      f.count = Math.max(0, num(f.count) - d);
      countIn.input.value = f.count; deadIn.input.value = '';
      refreshBiomass();
      toast(fmt('lset.deadDone', { n: d }), 'ok');
    } });

    const rmBtn = slButton({ label: '✕', variant: 'text', size: 'sm',
      onClick: () => { fish.splice(idx, 1); renderFish(); } });

    refreshEst();
    return el('div', { class: 'sl-card inset', style: 'margin-bottom:var(--sl-sp-2);box-shadow:none' }, [
      el('div', { class: 'sl-row-between', style: 'margin-bottom:var(--sl-sp-1)' }, [
        el('span', { class: 'sl-label', style: 'color:var(--sl-primary)', text: `${t('lset.fishN')} #${idx + 1}` }),
        rmBtn,
      ]),
      el('div', { class: 'sl-stack-sm' }, [
        el('div', {}, [el('label', { class: 'sl-caption', text: t('lset.type') }), typeSel]),
        el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap;align-items:flex-end' },
          [countIn, swIn, awIn]),
        estBox,
        el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);align-items:flex-end;flex-wrap:wrap' },
          [deadIn, deadBtn]),
      ]),
    ]);
  }

  function renderFish() {
    mount(fishList, ...(fish.length
      ? fish.map((f, i) => fishRow(f, i))
      : [el('div', { class: 'sl-body-sm sl-text-secondary', style: 'padding:8px 0', text: t('lset.noFish') })]));
    addFishBtn.disabled = fish.length >= MAX_FISH;
    refreshBiomass();
  }

  const addFishBtn = slButton({ label: t('lset.addFish'), variant: 'outlined', onClick: () => {
    if (fish.length >= MAX_FISH) return;
    fish.push({ typeId: null, type: '', count: null, startWeight: null, avgWeight: null });
    renderFish();
  } });

  const fishCard = slCard([
    secTitle('fish', fmt('lset.fishTitle', { n: MAX_FISH }), '--sl-chart-ph'),
    fishList, biomassEl,
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);margin-top:var(--sl-sp-3);flex-wrap:wrap' }, [
      addFishBtn,
      slButton({ label: t('common.save'), variant: 'secondary', onClick: () => {
        const clean = fish
          .filter((f) => f.typeId || (f.type || '').trim() || num(f.count) > 0)
          .slice(0, MAX_FISH)
          .map(({ stockedAt, ...rest }) => rest);   // stockedAt eksportdan o'chiriladi
        save({ fish: clean, fishUpdatedAt: Date.now() }, t('lset.fishSaved'));
      } }),
    ]),
  ]);

  /* ============================================================
     3 · YEM (katalogdan; fermer faqat tur + narx)
     ============================================================ */
  const feedSelWrap = el('div');
  let feedSel = null;
  const feedPriceIn = field(t('lset.price'), { step: '100', ph: '12000' });
  const feedCatInfo = el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)' });

  function feedCatItem(id) { return catalogs.feed.find((c) => c.id === id) || null; }
  function refreshFeedInfo() {
    const c = feedSel ? feedCatItem(feedSel.value) : null;
    feedCatInfo.textContent = c ? fmt('lset.fromCatalog', { p: c.protein ?? '—', f: c.fcr ?? '—' }) : '';
  }
  function buildFeedSelect() {
    const legacy = meta && meta.feed && !meta.feed.typeId && meta.feed.type;
    const opts = [
      { value: '', label: t('lset.pickType') },
      ...catalogs.feed.map((c) => ({ value: c.id, label: catalogName(c, isUz) })),
    ];
    if (legacy) opts.push({ value: '_legacy', label: `${meta.feed.type} ${t('lset.legacy')}` });
    feedSel = slSelect(opts, (meta && meta.feed && meta.feed.typeId) || (legacy ? '_legacy' : ''));
    feedSel.addEventListener('change', refreshFeedInfo);
    mount(feedSelWrap, el('label', { class: 'sl-caption', text: t('lset.feedType') }), feedSel);
    refreshFeedInfo();
  }

  const feedCard = slCard([
    secTitle('feed', t('lset.feedTitle'), '--sl-chart-feed'),
    el('div', { class: 'sl-stack-sm' }, [feedSelWrap, feedPriceIn, feedCatInfo]),
    el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
      slButton({ label: t('common.save'), variant: 'secondary', onClick: () => {
        const c = feedSel ? feedCatItem(feedSel.value) : null;
        const legacyType = (meta && meta.feed && meta.feed.type) || '';
        save({ feed: {
          typeId:   c ? c.id             : null,
          type:     c ? catalogName(c, isUz) : legacyType,
          protein:  c ? (c.protein ?? null)  : ((meta && meta.feed && meta.feed.protein) ?? null),
          fcr:      c ? (c.fcr ?? null)      : ((meta && meta.feed && meta.feed.fcr) ?? null),
          price:    numOrNull(feedPriceIn.input.value),
        } });
      } }),
    ]),
  ]);

  /* ============================================================
     4 · AERATORLAR (faqat soni + kW; model olib tashlandi)
     ============================================================ */
  const aerCountIn = field(t('lset.aerCount'), { ph: '2' });
  const aerKwIn    = field(t('lset.aerKw'), { step: '0.1', ph: '1.5' });

  const aeratorCard = slCard([
    secTitle('power', t('lset.aerTitle'), '--sl-chart-energy'),
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap;align-items:flex-end' },
      [aerCountIn, aerKwIn]),
    el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)', text: t('lset.aerNote') }),
    el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
      slButton({ label: t('common.save'), variant: 'secondary', onClick: () => {
        const count = num(aerCountIn.input.value);
        const kwEach = num(aerKwIn.input.value);
        const totalKw = count > 0 && kwEach > 0 ? +(count * kwEach).toFixed(2) : (kwEach || null);
        save({
          aerators: {
            count:  count || null,
            model:  (meta && meta.aerators && meta.aerators.model) || '',  // eski qiymat SAQLANADI
            kw:     kwEach || null,
          },
          energy: {
            ...((meta && meta.energy) || {}),
            kw: totalKw ?? ((meta && meta.energy && meta.energy.kw) || null),
          },
        });
      } }),
    ]),
  ]);

  /* ============================================================
     5 · ELEKTR NARXI — aeratordan ajralib, alohida karta
         Hisobot bu qiymatni O'QIYDI, Sozlamalar O'ZGARTIRADI.
     ============================================================ */
  const tariffIn = field(t('lset.aerTariff'), { step: '10', ph: '1000' });
  const tariffCard = slCard([
    secTitle('zap', t('lset.tariffTitle'), '--sl-chart-energy'),
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);flex-wrap:wrap;align-items:flex-end' },
      [tariffIn]),
    el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1)', text: t('lset.tariffNote') }),
    el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
      slButton({ label: t('common.save'), variant: 'secondary', onClick: () => {
        const tariff = numOrNull(tariffIn.input.value);
        if (tariff == null) return toast(t('lset.enterNum'), 'err');
        save({ energy: { ...((meta && meta.energy) || {}), tariff } });
      } }),
    ]),
  ]);

  const note = el('div', { class: 'sl-banner info' }, [
    el('span', { html: slIcon('info', 15), style: 'display:inline-flex;flex:none' }),
    el('span', { text: t('lset.metaNote') }),
  ]);

  /* ============================================================
     Tartib: Qurilmalar (eng yuqori) → Pasport → Baliq → Yem →
     Aerator → Elektr narxi → Izoh
     ============================================================ */
  const node = el('div', { class: 'sl-stack' }, [
    el('div', { class: 'sl-devices-slot' }, [devicesCard || null].filter(Boolean)),
    passportCard,
    fishCard,
    feedCard,
    aeratorCard,
    tariffCard,
    note,
  ].filter(Boolean));

  /* ---------- Parallel yuklash: katalog + meta ---------- */
  Promise.all([
    loadCatalogs().catch(() => ({ fish: [], feed: [] })),
    loadLakeMeta(lakeId).catch(() => null),
  ]).then(([cats, m]) => {
    catalogs = cats;
    meta = m || null;
    if (m) {
      if (m.passport) {
        if (m.passport.area     != null) areaIn.input.value     = m.passport.area;
        if (m.passport.avgDepth != null) avgDepthIn.input.value = m.passport.avgDepth;
        if (m.passport.maxDepth != null) maxDepthIn.input.value = m.passport.maxDepth;
      }
      fish = Array.isArray(m.fish) ? m.fish.map((f) => ({ ...f })) : [];
      if (m.feed && m.feed.price != null) feedPriceIn.input.value = m.feed.price;
      if (m.aerators) {
        if (m.aerators.count != null) aerCountIn.input.value = m.aerators.count;
        if (m.aerators.kw    != null) aerKwIn.input.value    = m.aerators.kw;
      }
      if (m.energy && m.energy.tariff != null) tariffIn.input.value = m.energy.tariff;
    }
    buildFeedSelect();
    renderFish();
  });
  renderFish();

  return node;
}

export default buildLakeSettingsTab;
