// ============================================================
//  design-system/components/badge.js — SMARTLAKE DS 3.0 · BADGE
//  ------------------------------------------------------------
//  Status belgilar: online | offline | healthy | warning |
//  critical | ai | success | danger | info | neutral
//  Domen statuslari (statusEngine natijalari) xaritada — ekranlar
//  mapping'ni takrorlamaydi.
// ============================================================

import { el } from '../../shared/dom.js';
import { slIcon } from './icons.js';

/** Domen statusi -> badge turi (statusEngine/presence natijalari uchun). */
export const STATUS_TO_BADGE = {
  healthy: 'healthy', good: 'healthy',
  warning: 'warning',
  critical: 'critical',
  online: 'online', offline: 'offline',
  unknown: 'neutral', pending: 'warning',
  active: 'success', suspended: 'danger',
};

/**
 * Status badge.
 * @param {object} p
 * @param {'online'|'offline'|'healthy'|'warning'|'critical'|'ai'|'success'|'danger'|'info'|'neutral'} p.type
 * @param {string} p.label
 * @param {boolean} [p.dot=true]  — chap nuqta
 * @param {string} [p.icon]       — nuqta o'rniga ikon
 */
export function slBadge({ type = 'neutral', label, dot = true, icon: ic }) {
  const kids = [];
  if (ic) kids.push(el('span', { style: 'display:inline-flex', html: slIcon(ic, 13) }));
  else if (dot) kids.push(el('span', { class: 'bd-dot' }));
  kids.push(el('span', { text: label ?? '' }));
  return el('span', { class: `sl-badge ${type}` }, kids);
}

/** Domen statusidan badge (mapping bilan). */
export function slStatusBadge(status, label) {
  return slBadge({ type: STATUS_TO_BADGE[status] || 'neutral', label });
}

/** Kichik ogohlantirish nuqtasi (nav item / ikonka ustiga). */
export function slDotBadge() {
  return el('span', { class: 'sl-dot-badge', 'aria-hidden': 'true' });
}

export default { slBadge, slStatusBadge, slDotBadge, STATUS_TO_BADGE };
