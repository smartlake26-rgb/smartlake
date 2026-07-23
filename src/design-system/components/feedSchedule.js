// ============================================================
//  design-system/components/feedSchedule.js — YEM JADVALI (reusable)
//  "08:00 — 18.0 kg" ko'rinishidagi kunlik yem rejasi bloki.
//  Dashboard ko'l kartasi, Ko'llar katalogi va boshqa joylarda
//  BIR XIL ko'rinishda ishlatiladi (takroriy kod yo'q).
//  Sof prezentatsiya: meals props orqali; hisob feedEngine'da qoladi.
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon } from './icons.js';

/**
 * @param {object} p
 * @param {string} p.title            — "Bugungi yem" (i18n'dan)
 * @param {number|null} [p.totalKg]   — kunlik jami (sarlavhada ko'rinadi)
 * @param {Array<{time:string, kg:number}>} [p.meals]
 * @param {string} [p.emptyText]      — reja yo'q holati ("Hozircha hisoblanmagan")
 * @param {string} [p.colorVar='--sl-chart-feed']
 */
export function slFeedSchedule({ title, totalKg = null, meals = [], emptyText = '', colorVar = '--sl-chart-feed' } = {}) {
  if (!meals.length) {
    return el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-3)', text: emptyText });
  }
  return el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
    el('div', {
      class: 'sl-label',
      style: `color:var(${colorVar});margin-bottom:var(--sl-sp-1);display:flex;align-items:center;gap:5px`,
    }, [
      el('span', { style: 'display:inline-flex', html: slIcon('feed', 13) }),
      el('span', { text: totalKg != null ? `${title} · ${totalKg.toFixed(1)} kg` : title }),
    ]),
    el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
      meals.map((m) => el('span', {
        class: 'sl-badge neutral',
        style: 'font-variant-numeric:tabular-nums',
        text: `${m.time} — ${m.kg.toFixed(1)} kg`,
      }))),
  ]);
}

export default { slFeedSchedule };
