// ============================================================
//  features/lakes/views/lakeSettingsTab.js — SOZLAMALAR tabi (C-bosqich)
//  Ko'l pasporti: maydon/chuqurlik · 4 tagacha baliq turi (qo'shish,
//  o'lim kiritish, vazn yangilash) · yem (turi/protein/narx) ·
//  aeratorlar (soni/model/kW). Hammasi FAQAT Firebase'da (lakeMeta) —
//  qurilmaga YUBORILMAYDI (topshiriq qoidasi). Saqlangach yem/elektr
//  hisoblari avtomatik yangilanadi (onSaved callback).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { mdCard, mdButton, input } from '../../../shared/ui/index.js';
import { loadLakeMeta, saveLakeMeta } from '../../telemetry/services/archiveService.js';
import { biomassKg } from '../../telemetry/domain/feedEngine.js';

const MAX_FISH = 4;

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function numOrNull(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }

export function buildLakeSettingsTab({ lakeId, uid, isUz, onSaved }) {
  let meta = null;
  let fish = [];   // [{type, count, startWeight, avgWeight}]

  const L = (uz, ru) => (isUz ? uz : ru);

  // ---------- umumiy yordamchilar ----------
  const secTitle = (ic, txt, color = 'var(--md-primary)') =>
    el('div', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px;margin-bottom:10px' }, [
      el('span', { html: icon(ic, 16), style: `color:${color};display:inline-flex` }),
      el('span', { text: txt }),
    ]);
  const fRow = (label, inputEl) => el('div', { class: 'md-field', style: 'flex:1;min-width:120px' }, [
    el('label', { text: label }), inputEl,
  ]);
  async function save(patch, okMsg) {
    try {
      await saveLakeMeta(lakeId, uid, patch);
      meta = { ...(meta || {}), ...patch };
      toast(okMsg || L('Saqlandi', 'Сохранено'), 'ok');
      if (onSaved) onSaved(meta);
    } catch (e) { toast((e && e.message) || 'Xato', 'err'); }
  }

  // ---------- 1. KO'L PASPORTI ----------
  const areaIn = input({ type: 'number', min: '0', step: '0.01', placeholder: '1.5' });
  const avgDepthIn = input({ type: 'number', min: '0', step: '0.1', placeholder: '1.8' });
  const maxDepthIn = input({ type: 'number', min: '0', step: '0.1', placeholder: '3.0' });
  const passportCard = mdCard([
    secTitle('droplet', L("Ko'l pasporti", 'Паспорт озера')),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
      fRow(L('Suv maydoni (ga)', 'Площадь (га)'), areaIn),
      fRow(L("O'rtacha chuqurlik (m)", 'Средняя глубина (м)'), avgDepthIn),
      fRow(L('Maks chuqurlik (m)', 'Макс. глубина (м)'), maxDepthIn),
    ]),
    el('div', { style: 'margin-top:12px' }, [
      mdButton({ label: L('Saqlash', 'Сохранить'), variant: 'tonal', onClick: () =>
        save({ passport: { area: numOrNull(areaIn.value), avgDepth: numOrNull(avgDepthIn.value), maxDepth: numOrNull(maxDepthIn.value) } }) }),
    ]),
  ]);

  // ---------- 2. BALIQ TURLARI ----------
  const fishList = el('div', {});
  const biomassEl = el('div', { class: 't-body-sm', style: 'font-weight:800;color:var(--md-primary);font-variant-numeric:tabular-nums' });
  function refreshBiomass() {
    const bm = biomassKg(fish);
    biomassEl.textContent = `${L('Umumiy biomassa', 'Общая биомасса')}: ${bm > 0 ? bm.toFixed(1) + ' kg' : '—'}`;
  }
  function fishRow(f, idx) {
    const typeIn = input({ type: 'text', placeholder: L('Karp', 'Карп') }); typeIn.value = f.type || '';
    const countIn = input({ type: 'number', min: '0', step: '1' }); countIn.value = f.count ?? '';
    const swIn = input({ type: 'number', min: '0', step: '1', placeholder: 'g' }); swIn.value = f.startWeight ?? '';
    const awIn = input({ type: 'number', min: '0', step: '1', placeholder: 'g' }); awIn.value = f.avgWeight ?? '';
    const deadIn = input({ type: 'number', min: '0', step: '1', placeholder: '0', style: 'max-width:80px;text-align:center' });
    [typeIn, countIn, swIn, awIn].forEach((inp, i) => inp.addEventListener('input', () => {
      const keys = ['type', 'count', 'startWeight', 'avgWeight'];
      f[keys[i]] = i === 0 ? inp.value : numOrNull(inp.value);
      refreshBiomass();
    }));
    const deadBtn = mdButton({ label: L("O'lim kiritish", 'Внести падёж'), variant: 'outlined', onClick: () => {
      const d = num(deadIn.value);
      if (d <= 0) return toast(L("Sonni kiriting", 'Введите число'), 'err');
      f.count = Math.max(0, (num(f.count)) - d);
      countIn.value = f.count; deadIn.value = '';
      refreshBiomass();
      toast(L(`${d} ta ayirildi — Saqlashni unutmang`, `Вычтено ${d} — не забудьте Сохранить`), 'ok');
    } });
    deadBtn.classList.add('sm');
    const rmBtn = mdButton({ label: '✕', variant: 'text', onClick: () => { fish.splice(idx, 1); renderFish(); } });
    rmBtn.classList.add('sm');
    return el('div', { style: 'padding:12px;border-radius:var(--shape-md);border:1px solid var(--md-outline-variant);background:var(--md-surface-container-low);margin-bottom:10px' }, [
      el('div', { class: 'row-between', style: 'margin-bottom:6px' }, [
        el('span', { class: 't-label', style: 'color:var(--md-primary)', text: `${L('Baliq', 'Рыба')} #${idx + 1}` }),
        rmBtn,
      ]),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, [
        fRow(L('Turi', 'Вид'), typeIn),
        fRow(L('Soni (dona)', 'Кол-во (шт)'), countIn),
        fRow(L("Boshl. vazni (g)", 'Нач. вес (г)'), swIn),
        fRow(L('Joriy vazni (g)', 'Тек. вес (г)'), awIn),
      ]),
      el('div', { style: 'display:flex;gap:8px;align-items:flex-end;margin-top:8px;flex-wrap:wrap' }, [deadIn, deadBtn]),
    ]);
  }
  function renderFish() {
    mount(fishList, ...(fish.length ? fish.map((f, i) => fishRow(f, i))
      : [el('div', { class: 't-body-sm muted', style: 'padding:8px 0', text: L("Hali baliq kiritilmagan", 'Рыба ещё не добавлена') })]));
    addFishBtn.disabled = fish.length >= MAX_FISH;
    refreshBiomass();
  }
  const addFishBtn = mdButton({ label: L('+ Baliq qo\u02bbshish', '+ Добавить рыбу'), variant: 'outlined', onClick: () => {
    if (fish.length >= MAX_FISH) return;
    fish.push({ type: '', count: null, startWeight: null, avgWeight: null });
    renderFish();
  } });
  const fishCard = mdCard([
    secTitle('activity', L(`Baliq turlari (maks ${MAX_FISH} ta)`, `Виды рыбы (макс ${MAX_FISH})`), 'var(--chart-ph)'),
    fishList, biomassEl,
    el('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' }, [
      addFishBtn,
      mdButton({ label: L('Saqlash', 'Сохранить'), variant: 'tonal', onClick: () => {
        const clean = fish.filter((f) => (f.type || '').trim() || num(f.count) > 0).slice(0, MAX_FISH);
        save({ fish: clean, fishUpdatedAt: Date.now() }, L('Baliq ma\u02bblumotlari saqlandi', 'Данные рыбы сохранены'));
      } }),
    ]),
  ]);

  // ---------- 3. YEM ----------
  const feedTypeIn = input({ type: 'text', placeholder: L('Granula', 'Гранулы') });
  const proteinIn = input({ type: 'number', min: '0', max: '100', step: '1', placeholder: '32' });
  const feedPriceIn = input({ type: 'number', min: '0', step: '100', placeholder: '12000' });
  const feedCard = mdCard([
    secTitle('droplet', L('Yem', 'Корм'), 'var(--md-tertiary)'),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
      fRow(L('Yem turi', 'Тип корма'), feedTypeIn),
      fRow(L('Protein (%)', 'Протеин (%)'), proteinIn),
      fRow(L("Narxi (so'm/kg)", 'Цена (сум/кг)'), feedPriceIn),
    ]),
    el('div', { style: 'margin-top:12px' }, [
      mdButton({ label: L('Saqlash', 'Сохранить'), variant: 'tonal', onClick: () =>
        save({ feed: { type: feedTypeIn.value.trim(), protein: numOrNull(proteinIn.value), price: numOrNull(feedPriceIn.value) } }) }),
    ]),
  ]);

  // ---------- 4. AERATORLAR ----------
  const aerCountIn = input({ type: 'number', min: '0', step: '1', placeholder: '2' });
  const aerModelIn = input({ type: 'text', placeholder: 'YL-1.5' });
  const aerKwIn = input({ type: 'number', min: '0', step: '0.1', placeholder: '1.5' });
  const aeratorCard = mdCard([
    secTitle('power', L('Aeratorlar', 'Аэраторы'), 'var(--chart-temp)'),
    el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap' }, [
      fRow(L('Soni', 'Кол-во'), aerCountIn),
      fRow(L('Modeli', 'Модель'), aerModelIn),
      fRow(L('Bittasining quvvati (kW)', 'Мощность одного (кВт)'), aerKwIn),
    ]),
    el('div', { class: 't-caption', style: 'margin-top:6px', text: L(
      "Saqlanganda Tarix > Elektr hisobidagi umumiy quvvat (soni × kW) avtomatik yangilanadi.",
      'При сохранении общая мощность в Истории (кол-во × кВт) обновится автоматически.') }),
    el('div', { style: 'margin-top:12px' }, [
      mdButton({ label: L('Saqlash', 'Сохранить'), variant: 'tonal', onClick: () => {
        const count = num(aerCountIn.value), kwEach = num(aerKwIn.value);
        const totalKw = count > 0 && kwEach > 0 ? +(count * kwEach).toFixed(2) : (kwEach || null);
        save({
          aerators: { count: count || null, model: aerModelIn.value.trim(), kw: kwEach || null },
          energy: { ...((meta && meta.energy) || {}), kw: totalKw ?? ((meta && meta.energy && meta.energy.kw) || null) },
        });
      } }),
    ]),
  ]);

  const note = el('div', { class: 'md-banner info' }, [
    el('span', { html: icon('info', 15), style: 'display:inline-flex;flex:none' }),
    el('span', { text: L(
      "Bu ma'lumotlar faqat Firebase'da saqlanadi — qurilmaga yuborilmaydi. Yem va elektr hisoblari shu yerdan oziqlanadi.",
      'Эти данные хранятся только в Firebase — на устройство не отправляются.') }),
  ]);

  const node = el('div', { class: 'stack' }, [note, passportCard, fishCard, feedCard, aeratorCard]);

  // ---------- meta yuklash ----------
  loadLakeMeta(lakeId).then((m) => {
    meta = m || null;
    if (m) {
      if (m.passport) {
        if (m.passport.area != null) areaIn.value = m.passport.area;
        if (m.passport.avgDepth != null) avgDepthIn.value = m.passport.avgDepth;
        if (m.passport.maxDepth != null) maxDepthIn.value = m.passport.maxDepth;
      }
      fish = Array.isArray(m.fish) ? m.fish.map((f) => ({ ...f })) : [];
      if (m.feed) {
        feedTypeIn.value = m.feed.type || '';
        if (m.feed.protein != null) proteinIn.value = m.feed.protein;
        if (m.feed.price != null) feedPriceIn.value = m.feed.price;
      }
      if (m.aerators) {
        if (m.aerators.count != null) aerCountIn.value = m.aerators.count;
        aerModelIn.value = m.aerators.model || '';
        if (m.aerators.kw != null) aerKwIn.value = m.aerators.kw;
      }
    }
    renderFish();
  }).catch(() => renderFish());
  renderFish();

  return node;
}

export default buildLakeSettingsTab;
