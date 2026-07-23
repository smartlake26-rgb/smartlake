// ============================================================
//  design-system/components/monitorCard.js — MONITORING KARTASI
//  ------------------------------------------------------------
//  "Apple Weather" uslubidagi premium karta: suv-gradient cover
//  (SVG to'lqinlar), yuqori-o'ng holat indikatori, salomatlik
//  halqasi + baho, sensor katakchalari, footer (yangilanish +
//  signal). Sof prezentatsiya — barcha qiymatlar props orqali.
//  REUSABLE: Ko'llar sahifasi, dashboard, admin — istalgan joyda.
//  Ranglar FAQAT tokenlar orqali (hex yo'q).
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon } from './icons.js';
import { slBadge } from './badge.js';
import { slSensorCard } from './card.js';

/* Holat -> indikator/overlay token nomi */
const STATE_VAR = {
  online: '--sl-online',
  healthy: '--sl-online',
  warning: '--sl-warning',
  critical: '--sl-critical',
  offline: '--sl-offline',
  inactive: '--sl-offline',
  archived: '--sl-offline',
  unknown: '--sl-offline',
};

/* Mini salomatlik halqasi (44px) — token rangida. */
function healthRing(pct, colorVar, size = 46) {
  const r = 19; const c = 2 * Math.PI * r;
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return el('span', {
    style: 'display:inline-flex;flex:none',
    'aria-hidden': 'true',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 46 46">
      <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(--sl-gauge-track)" stroke-width="5"/>
      <circle cx="23" cy="23" r="${r}" fill="none" stroke="var(${colorVar})" stroke-width="5"
        stroke-linecap="round" stroke-dasharray="${(c * v / 100).toFixed(1)} ${c.toFixed(1)}"
        transform="rotate(-90 23 23)"
        style="transition:stroke-dasharray var(--sl-motion-slower) var(--sl-ease-out)"/>
    </svg>`,
  });
}

/**
 * Premium monitoring kartasi.
 * @param {object} p
 * @param {string}  p.name
 * @param {'online'|'warning'|'critical'|'offline'|'inactive'|'archived'|'unknown'} p.statusKind
 *        — yuqori-o'ng indikator va cover tusi uchun
 * @param {string}  p.statusLabel   — badge matni (i18n'dan)
 * @param {string} [p.meta]         — nom ostidagi kichik qator (joylashuv, qurilma soni)
 * @param {number|null} [p.health]  — 0..100 (null -> UI tayyor, "—")
 * @param {string} [p.gradeLabel]   — "A'lo/Yaxshi/..." (i18n'dan)
 * @param {string} [p.gradeColorVar='--sl-success']
 * @param {Array}  [p.cells]        — slSensorCard props ro'yxati (DO/Temp ...)
 * @param {string} [p.updatedText]  — "Yangilandi: 5 daq oldin"
 * @param {string} [p.signalText]   — "Signal: Yaxshi (-72 dBm)" (bo'lsa)
 * @param {Function} [p.onClick]
 * @param {string} [p.ariaLabel]
 * @param {boolean} [p.dim=false]   — arxiv/inactive uchun xira ko'rinish
 */
export function slLakeMonitorCard({
  name, statusKind = 'unknown', statusLabel = '', meta = '',
  health = null, gradeLabel = '', gradeColorVar = '--sl-success',
  cells = [], updatedText = '', signalText = '',
  onClick, ariaLabel, dim = false,
} = {}) {
  const stateVar = STATE_VAR[statusKind] || STATE_VAR.unknown;

  // --- COVER: suv gradienti + SVG to'lqinlar + holat indikatori ---
  const cover = el('div', { class: `sl-monitor-cover st-${statusKind}` }, [
    el('span', {
      class: 'mn-waves', 'aria-hidden': 'true',
      html: `<svg viewBox="0 0 400 90" preserveAspectRatio="none">
        <path d="M0,58 C60,48 120,68 200,58 C280,48 340,66 400,56 L400,90 L0,90 Z" fill="currentColor" opacity=".16"/>
        <path d="M0,70 C80,62 140,78 220,70 C300,62 350,76 400,68 L400,90 L0,90 Z" fill="currentColor" opacity=".22"/>
      </svg>`,
    }),
    el('span', {
      class: 'mn-dot', title: statusLabel,
      style: `background:var(${stateVar});box-shadow:0 0 0 3px color-mix(in srgb, var(${stateVar}) 25%, transparent), 0 0 8px var(${stateVar})`,
    }),
    el('div', { class: 'mn-cover-txt' }, [
      el('div', { class: 'mn-name', text: name }),
      meta ? el('div', { class: 'mn-meta', text: meta }) : null,
    ].filter(Boolean)),
  ]);

  // --- BODY: salomatlik + sensor katakchalari + footer ---
  const healthRow = el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-3)' }, [
    healthRing(health, health == null ? '--sl-offline' : gradeColorVar),
    el('div', { class: 'sl-grow' }, [
      el('div', { class: 'sl-row', style: 'align-items:baseline;gap:6px' }, [
        el('span', { class: 'sl-num-md', style: `color:var(${health == null ? '--sl-text-disabled' : gradeColorVar})`,
          text: health == null ? '—' : `${health}%` }),
        gradeLabel && health != null
          ? el('span', { class: 'sl-body-sm', style: `font-weight:700;color:var(${gradeColorVar})`, text: gradeLabel })
          : null,
      ].filter(Boolean)),
      el('div', { class: 'sl-caption', text: statusLabel }),
    ]),
    el('span', {}, [slBadge({ type: statusKind === 'online' ? 'online'
      : statusKind === 'warning' ? 'warning'
      : statusKind === 'critical' ? 'critical' : 'offline', label: statusLabel })]),
  ]);

  const body = el('div', { class: 'sl-monitor-body' }, [
    healthRow,
    cells.length ? el('div', { class: 'sl-grid-2', style: 'margin-top:var(--sl-sp-3)' },
      cells.map((c) => slSensorCard(c))) : null,
    (updatedText || signalText) ? el('div', { class: 'sl-monitor-foot' }, [
      updatedText ? el('span', { class: 'sl-row', style: 'gap:4px' }, [
        el('span', { style: 'display:inline-flex;opacity:.7', html: slIcon('clock', 12) }),
        el('span', { text: updatedText }),
      ]) : null,
      signalText ? el('span', { class: 'sl-row', style: 'gap:4px' }, [
        el('span', { style: 'display:inline-flex;opacity:.7', html: slIcon('wifi', 12) }),
        el('span', { text: signalText }),
      ]) : null,
    ].filter(Boolean)) : null,
  ].filter(Boolean));

  const card = el('div', {
    class: `sl-card sl-monitor${dim ? ' dim' : ''}`,
  }, [cover, body]);

  if (onClick) {
    card.classList.add('interactive');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', ariaLabel || name);
    card.addEventListener('click', onClick);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
    });
  }
  return card;
}

export default { slLakeMonitorCard };
