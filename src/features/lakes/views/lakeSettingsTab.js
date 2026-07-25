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
import * as dataStore from '../../../farmer/dataStore.js';
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

  /* Umumiy sozlama modal (bottom sheet) */
  function openSettingsModal(title, bodyEls, onSave) {
    const scrim = el('div', {
      style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:flex-end',
    });
    const sheet = el('div', {
      style: 'background:var(--sl-card,#fff);width:100%;max-width:480px;margin:0 auto;'
           + 'border-radius:20px 20px 0 0;padding:8px 20px 32px;max-height:85vh;overflow-y:auto;'
           + 'box-shadow:0 -4px 32px rgba(0,0,0,.18)',
    });
    function close() { scrim.remove(); }
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
    sheet.append(
      el('div', { style: 'width:40px;height:4px;border-radius:2px;background:var(--sl-border,#ddd);margin:12px auto 16px' }),
      el('div', { style: 'font-size:16px;font-weight:800;margin-bottom:16px;color:var(--sl-on-surface)', text: title }),
      ...bodyEls,
      el('div', { style: 'display:flex;gap:10px;margin-top:20px' }, [
        el('button', { type: 'button',
          style: 'flex:1;padding:14px;border-radius:12px;border:1.5px solid var(--sl-border);background:var(--sl-card);font-size:14px;font-weight:600;cursor:pointer;color:var(--sl-text-secondary)',
          text: isUz ? 'Bekor' : 'Отмена', onClick: close }),
        el('button', { type: 'button',
          style: 'flex:1;padding:14px;border-radius:12px;border:none;background:var(--sl-primary);color:#fff;font-size:14px;font-weight:700;cursor:pointer',
          text: isUz ? 'Saqlash' : 'Сохранить', onClick: () => { onSave(); close(); } }),
      ]),
    );
    scrim.append(sheet);
    document.body.append(scrim);
  }

  /* ============================================================
     1 · KO'L PASPORTI (ixcham ko'rsatish + modal tahrirlash)
     ============================================================ */
  let passArea = null, passAvgD = null, passMaxD = null;

  function passportRow() {
    const items = [
      { label: t('lset.area'), val: passArea, unit: isUz ? 'ga' : 'га' },
      { label: t('lset.avgDepth'), val: passAvgD, unit: isUz ? 'm' : 'м' },
      { label: t('lset.maxDepth'), val: passMaxD, unit: isUz ? 'm' : 'м' },
    ];
    return el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px' },
      items.map(({ label, val, unit }) =>
        el('div', { style: 'text-align:center;padding:12px 8px;border-radius:12px;background:var(--sl-card-inset,#f8fafa)' }, [
          el('div', { style: 'font-size:18px;font-weight:800;color:var(--sl-on-surface,#1a2a3a)', text: val != null ? String(val) : '—' }),
          el('div', { style: 'font-size:10px;color:var(--sl-text-secondary);margin-top:2px', text: `${label} (${unit})` }),
        ])
      ));
  }

  const passContent = el('div');
  function renderPassport() {
    mount(passContent, passportRow());
  }

  function openPassportForm() {
    const aIn = field(t('lset.area'), { step: '0.01', ph: '1.5' }); aIn.input.value = passArea ?? '';
    const dIn = field(t('lset.avgDepth'), { step: '0.1', ph: '1.8' }); dIn.input.value = passAvgD ?? '';
    const mIn = field(t('lset.maxDepth'), { step: '0.1', ph: '3.0' }); mIn.input.value = passMaxD ?? '';
    openSettingsModal(isUz ? "Ko'l pasporti" : 'Паспорт озера', [
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px' }, [aIn, dIn, mIn]),
    ], () => {
      passArea = numOrNull(aIn.input.value);
      passAvgD = numOrNull(dIn.input.value);
      passMaxD = numOrNull(mIn.input.value);
      save({ passport: { area: passArea, avgDepth: passAvgD, maxDepth: passMaxD } });
      renderPassport();
    });
  }

  const passportCard = slCard([
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' }, [
      secTitle('droplet', t('lset.passport')),
      el('button', { type: 'button', style: 'background:none;border:none;color:var(--sl-primary);cursor:pointer;padding:4px;display:flex',
        html: slIcon('edit', 16), onClick: openPassportForm }),
    ]),
    passContent,
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
    const name = f.type || (f.typeId ? catalogName(fishCatItem(f), isUz) : '—');
    const count = f.count != null ? String(f.count) : '—';
    const weight = f.avgWeight != null ? `${f.avgWeight}g` : '—';

    const row = el('div', {
      style: 'display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;'
           + 'background:var(--sl-card-inset,#f8fafa);margin-bottom:6px;'
           + 'animation:sl-ob-fade .25s ease both;transition:transform .15s,box-shadow .15s',
    }, [
      // Raqam badge
      el('div', {
        style: 'width:28px;height:28px;border-radius:50%;background:var(--sl-primary);color:#fff;'
             + 'display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex:none',
        text: String(idx + 1),
      }),
      // Ma'lumotlar
      el('div', { style: 'flex:1;min-width:0' }, [
        el('div', { style: 'font-size:14px;font-weight:700;color:var(--sl-on-surface,#1a2a3a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis', text: name }),
        el('div', { style: 'font-size:11px;color:var(--sl-text-secondary,#8aa);margin-top:2px',
          text: `${count} ${isUz ? 'dona' : 'шт'} · ${weight}` }),
      ]),
      // Tahrirlash
      el('button', {
        type: 'button',
        style: 'background:none;border:none;color:var(--sl-primary);cursor:pointer;padding:4px;display:flex',
        html: slIcon('edit', 16),
        onClick: () => openFishForm(idx),
      }),
      // O'chirish
      el('button', {
        type: 'button',
        style: 'background:none;border:none;color:var(--sl-critical,#D93025);cursor:pointer;padding:4px;display:flex',
        html: slIcon('x', 16),
        onClick: () => { fish.splice(idx, 1); renderFish(); },
      }),
    ]);
    row.addEventListener('mouseenter', () => { row.style.transform = 'translateX(4px)'; row.style.boxShadow = '0 2px 8px rgba(0,0,0,.06)'; });
    row.addEventListener('mouseleave', () => { row.style.transform = ''; row.style.boxShadow = ''; });
    return row;
  }

  /* Baliq qo'shish/tahrirlash formasi (bottom sheet) */
  function openFishForm(editIdx) {
    const isEdit = editIdx != null && editIdx >= 0;
    const f = isEdit ? { ...fish[editIdx] } : { typeId: null, type: '', count: null, startWeight: null, avgWeight: null };

    const opts = [
      { value: '', label: t('lset.pickType') },
      ...catalogs.fish.map((c) => ({ value: c.id, label: catalogName(c, isUz) })),
    ];
    const typeSel = slSelect(opts, f.typeId || '');
    const countIn = field(t('lset.count'));    countIn.input.value = f.count ?? '';
    const swIn    = field(t('lset.startW'), { ph: 'g' }); swIn.input.value = f.startWeight ?? '';
    const awIn    = field(t('lset.avgW'),   { ph: 'g' }); awIn.input.value = f.avgWeight ?? '';

    const scrim = el('div', {
      style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:flex-end',
    });
    const sheet = el('div', {
      style: 'background:var(--sl-card,#fff);width:100%;max-width:480px;margin:0 auto;'
           + 'border-radius:20px 20px 0 0;padding:8px 20px 32px;max-height:85vh;overflow-y:auto;'
           + 'box-shadow:0 -4px 32px rgba(0,0,0,.18)',
    });

    function close() { scrim.remove(); }
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

    sheet.append(
      el('div', { style: 'width:40px;height:4px;border-radius:2px;background:var(--sl-border,#ddd);margin:12px auto 16px' }),
      el('div', { style: 'font-size:16px;font-weight:800;margin-bottom:16px',
        text: isEdit ? (isUz ? 'Baliqni tahrirlash' : 'Редактировать рыбу') : (isUz ? 'Baliq qo\'shish' : 'Добавить рыбу') }),
      el('div', { style: 'margin-bottom:12px' }, [el('label', { class: 'sl-caption', text: t('lset.type') }), typeSel]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px' }, [countIn, swIn, awIn]),
      el('div', { style: 'display:flex;gap:10px' }, [
        el('button', {
          type: 'button',
          style: 'flex:1;padding:14px;border-radius:12px;border:1.5px solid var(--sl-border);background:var(--sl-card);'
               + 'font-size:14px;font-weight:600;cursor:pointer;color:var(--sl-text-secondary)',
          text: isUz ? 'Bekor' : 'Отмена',
          onClick: close,
        }),
        el('button', {
          type: 'button',
          style: 'flex:1;padding:14px;border-radius:12px;border:none;background:var(--sl-primary);'
               + 'color:#fff;font-size:14px;font-weight:700;cursor:pointer',
          text: isUz ? 'Saqlash' : 'Сохранить',
          onClick: () => {
            const val = {
              typeId: typeSel.value || null,
              type: typeSel.value ? catalogName(fishCatItem({ typeId: typeSel.value }), isUz) : '',
              count: numOrNull(countIn.input.value),
              startWeight: numOrNull(swIn.input.value),
              avgWeight: numOrNull(awIn.input.value),
            };
            if (isEdit) fish[editIdx] = val;
            else fish.push(val);
            renderFish();
            close();
          },
        }),
      ]),
    );

    scrim.append(sheet);
    document.body.append(scrim);
  }

  function renderFish() {
    mount(fishList, ...(fish.length
      ? fish.map((f, i) => fishRow(f, i))
      : [el('div', { class: 'sl-body-sm sl-text-secondary', style: 'padding:8px 0', text: t('lset.noFish') })]));
    addFishBtn.disabled = fish.length >= MAX_FISH;
    refreshBiomass();
  }

  const addFishBtn = slButton({ label: t('lset.addFish'), variant: 'outlined', icon: 'plus', onClick: () => {
    if (fish.length >= MAX_FISH) return;
    openFishForm(null);
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

  const feedContent = el('div');
  let feedType = '', feedPrice = null;

  function renderFeedInfo() {
    const name = feedType || (isUz ? 'Tanlanmagan' : 'Не выбран');
    const price = feedPrice != null ? `${feedPrice.toLocaleString()} ${isUz ? "so'm/kg" : 'сум/кг'}` : '—';
    mount(feedContent, el('div', { style: 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:var(--sl-card-inset,#f8fafa)' }, [
      el('div', { style: 'width:36px;height:36px;border-radius:50%;background:color-mix(in srgb,var(--sl-chart-feed) 12%,transparent);display:flex;align-items:center;justify-content:center;flex:none' }, [
        el('span', { style: 'color:var(--sl-chart-feed)', html: slIcon('feed', 18) }),
      ]),
      el('div', { style: 'flex:1' }, [
        el('div', { style: 'font-size:14px;font-weight:700;color:var(--sl-on-surface)', text: name }),
        el('div', { style: 'font-size:11px;color:var(--sl-text-secondary);margin-top:2px', text: price }),
      ]),
    ]));
  }

  function openFeedForm() {
    openSettingsModal(t('lset.feedTitle'), [feedSelWrap, feedPriceIn, feedCatInfo], () => {
      const c = feedSel ? feedCatItem(feedSel.value) : null;
      feedType = c ? catalogName(c, isUz) : '';
      feedPrice = numOrNull(feedPriceIn.input.value);
      save({ feed: {
        typeId: c ? c.id : null,
        type: feedType,
        protein: c ? (c.protein ?? null) : ((meta && meta.feed && meta.feed.protein) ?? null),
        fcr: c ? (c.fcr ?? null) : ((meta && meta.feed && meta.feed.fcr) ?? null),
        price: feedPrice,
      } });
      renderFeedInfo();
    });
  }

  const feedCard = slCard([
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' }, [
      secTitle('feed', t('lset.feedTitle'), '--sl-chart-feed'),
      el('button', { type: 'button', style: 'background:none;border:none;color:var(--sl-primary);cursor:pointer;padding:4px;display:flex',
        html: slIcon('edit', 16), onClick: openFeedForm }),
    ]),
    feedContent,
  ]);

  /* ============================================================
     4 · AERATOR + ELEKTR (ixcham ko'rsatish + modal)
     ============================================================ */

  const aerContent = el('div');
  let aerCount = null, aerKw = null, aerTariff = null;

  function renderAerInfo() {
    const items = [
      { label: isUz ? 'Soni' : 'Кол-во', val: aerCount, icon: 'power' },
      { label: isUz ? 'Quvvat' : 'Мощность', val: aerKw ? `${aerKw} kW` : '—', icon: 'zap' },
      { label: isUz ? 'Tarif' : 'Тариф', val: aerTariff ? `${aerTariff.toLocaleString()}` : '—', icon: 'creditCard' },
    ];
    mount(aerContent, el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px' },
      items.map(({ label, val, icon: ic }) =>
        el('div', { style: 'text-align:center;padding:12px 8px;border-radius:12px;background:var(--sl-card-inset,#f8fafa)' }, [
          el('div', { style: 'color:var(--sl-chart-energy);display:flex;justify-content:center;margin-bottom:4px', html: slIcon(ic, 16) }),
          el('div', { style: 'font-size:16px;font-weight:800;color:var(--sl-on-surface)', text: val != null ? String(val) : '—' }),
          el('div', { style: 'font-size:10px;color:var(--sl-text-secondary);margin-top:2px', text: label }),
        ])
      )));
  }

  function openAerForm() {
    const cIn = field(t('lset.aerCount'), { ph: '2' }); cIn.input.value = aerCount ?? '';
    const kIn = field(t('lset.aerKw'), { step: '0.1', ph: '1.5' }); kIn.input.value = aerKw ?? '';
    const tIn = field(t('lset.aerTariff'), { step: '10', ph: '1000' }); tIn.input.value = aerTariff ?? '';
    openSettingsModal(t('lset.aerTitle') + ' + ' + t('lset.tariffTitle'), [
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px' }, [cIn, kIn]),
      tIn,
      el('div', { style: 'font-size:11px;color:var(--sl-text-secondary);margin-top:4px', text: t('lset.tariffNote') }),
    ], () => {
      aerCount = numOrNull(cIn.input.value);
      aerKw = numOrNull(kIn.input.value);
      aerTariff = numOrNull(tIn.input.value);
      const totalKw = aerCount > 0 && aerKw > 0 ? +(aerCount * aerKw).toFixed(2) : (aerKw || null);
      save({
        aerators: { count: aerCount, model: (meta && meta.aerators && meta.aerators.model) || '', kw: aerKw },
        energy: { kw: totalKw ?? ((meta && meta.energy && meta.energy.kw) || null), tariff: aerTariff },
      });
      renderAerInfo();
    });
  }

  const aeratorCard = slCard([
    el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px' }, [
      secTitle('power', t('lset.aerTitle'), '--sl-chart-energy'),
      el('button', { type: 'button', style: 'background:none;border:none;color:var(--sl-primary);cursor:pointer;padding:4px;display:flex',
        html: slIcon('edit', 16), onClick: openAerForm }),
    ]),
    aerContent,
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
    note,
  ].filter(Boolean));

  /* ---------- Parallel yuklash: katalog + meta ---------- */
  Promise.all([
    loadCatalogs().catch(() => ({ fish: [], feed: [] })),
    loadLakeMeta(lakeId).catch(() => null),
  ]).then(([cats, m]) => {
    catalogs = cats;
    meta = m || null;

    // KO'L HUJJATI (lakes) — ko'l yaratishda kiritilgan ma'lumotlar fallback:
    // lakeMeta'da yo'q bo'lsa, ko'l yaratish formasida kiritilganlari ko'rsatiladi
    const lk = dataStore.getState().lakes.find((l) => l.id === lakeId)
      || dataStore.getState().archivedLakes.find((l) => l.id === lakeId) || null;

    // Pasport: meta > lake
    const pArea  = m?.passport?.area     ?? (lk && lk.area != null ? parseFloat(lk.area) : null);
    const pAvgD  = m?.passport?.avgDepth ?? (lk && lk.averageDepth != null ? parseFloat(lk.averageDepth) : null);
    const pMaxD  = m?.passport?.maxDepth ?? null;
    if (pArea != null && Number.isFinite(pArea)) passArea = pArea;
    if (pAvgD != null && Number.isFinite(pAvgD)) passAvgD = pAvgD;
    if (pMaxD != null) passMaxD = pMaxD;
    renderPassport();

    // Baliq: meta.fish bo'lsa u; bo'lmasa lake.fishSpecies dan konvert
    if (Array.isArray(m?.fish) && m.fish.length) {
      fish = m.fish.map((f) => ({ ...f }));
    } else if (lk && Array.isArray(lk.fishSpecies) && lk.fishSpecies.length) {
      // Katalogda nomi mos kelsa typeId avtomatik bog'lanadi
      const byName = (name) => cats.fish.find((c) =>
        catalogName(c, true) === name || catalogName(c, false) === name || c.id === name) || null;
      fish = lk.fishSpecies
        .filter((it) => it && (typeof it === 'object' ? it.species : it))
        .map((it) => {
          const nm = typeof it === 'object' ? it.species : String(it);
          const cat = byName(nm);
          return {
            typeId: cat ? cat.id : null,
            type: nm,
            count: typeof it === 'object' ? (it.count ?? null) : null,
            startWeight: null,
            avgWeight: typeof it === 'object' ? (it.avgWeight ?? null) : null,
          };
        });
    } else {
      fish = [];
    }

    if (m?.feed && m.feed.price != null) { feedPriceIn.input.value = m.feed.price; feedPrice = m.feed.price; }
    if (m?.feed && m.feed.type) feedType = m.feed.type;
    renderFeedInfo();
    if (m?.aerators) {
      if (m.aerators.count != null) { aerCount = m.aerators.count; }
      if (m.aerators.kw    != null) { aerKw = m.aerators.kw; }
    }
    if (m?.energy && m.energy.tariff != null) { aerTariff = m.energy.tariff; }
    renderAerInfo();

    buildFeedSelect();
    renderFish();
  });
  renderFish();

  return node;
}

export default buildLakeSettingsTab;
