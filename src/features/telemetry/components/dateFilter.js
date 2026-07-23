// ============================================================
//  features/telemetry/components/dateFilter.js — SANA FILTRI
//  Reusable: Bugun/Kecha/7 kun/30 kun/Yil/Ixtiyoriy oraliq.
//  Tarix (Data History) va Hisobot modullari BIR XIL filtrni
//  ishlatadi — takroriy kod yo'q. Sof UI: diapazon [fromTs,toTs]
//  ni hisoblab onChange ga beradi.
// ============================================================

import { el } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { toast } from '../../../shared/toast.js';
import { slField, slButton } from '../../../design-system/index.js';

const DAY = 24 * 3600e3;
const FILTERS = [
  ['bugun', 'hist.f_today'], ['kecha', 'hist.f_yesterday'],
  ['hafta', 'hist.f_7d'], ['oy', 'hist.f_30d'],
  ['yil', 'hist.f_year'], ['sana', 'hist.f_custom'],
];

/**
 * @param {object} p
 * @param {string} [p.initial='bugun']
 * @param {Function} p.onChange — (filterId) => void (diapazon getRange() dan olinadi)
 * @returns {{node:HTMLElement, getRange:()=>[number,number], getId:()=>string}}
 */
export function buildDateFilter({ initial = 'bugun', onChange } = {}) {
  let filter = initial;
  let customFrom = null; let customTo = null;

  function getRange() {
    const now = Date.now();
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    if (filter === 'bugun') return [startToday.getTime(), now];
    if (filter === 'kecha') return [startToday.getTime() - DAY, startToday.getTime() - 1];
    if (filter === 'hafta') return [now - 7 * DAY, now];
    if (filter === 'oy') return [now - 30 * DAY, now];
    if (filter === 'yil') return [now - 365 * DAY, now];
    return [customFrom || startToday.getTime(), (customTo || now) + DAY - 1];
  }

  const btns = new Map();
  const row = el('div', { class: 'sl-tabs', role: 'tablist', style: 'padding:0' },
    FILTERS.map(([id, key]) => {
      const b = el('button', { class: 'sl-tab' + (id === filter ? ' active' : ''),
        type: 'button', role: 'tab', text: t(key) });
      b.addEventListener('click', () => {
        filter = id;
        btns.forEach((x, xid) => x.classList.toggle('active', xid === filter));
        customRow.style.display = id === 'sana' ? 'flex' : 'none';
        if (id !== 'sana' && onChange) onChange(filter);
      });
      btns.set(id, b);
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
      if (onChange) onChange(filter);
    } }),
  ]);

  return { node: el('div', {}, [row, customRow]), getRange, getId: () => filter };
}

export default { buildDateFilter };
