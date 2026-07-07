// ============================================================
//  features/lakes/domain/lakeStatus.js
//  Ko'l statusi — CHEKLI HOLAT MASHINASI. Soft-delete: archived
//  terminal (fizik o'chirish yo'q). Sof modul -> test-oson.
// ============================================================

import { LAKE_STATUS as S } from '../../../core/collections.js';
import { StateError } from '../../../core/errors.js';

/** Ruxsat etilgan o'tishlar. */
export const TRANSITIONS = Object.freeze({
  [S.ACTIVE]: [S.INACTIVE, S.ARCHIVED],
  [S.INACTIVE]: [S.ACTIVE, S.ARCHIVED],
  [S.ARCHIVED]: [],              // terminal (soft-delete)
});

export const ALL_STATES = Object.freeze(Object.values(S));

export function isValidStatus(s) { return ALL_STATES.includes(s); }

export function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

export function assertTransition(from, to) {
  if (!isValidStatus(to)) throw new StateError(`Noma'lum status: ${to}`, { messageKey: 'error.state' });
  if (!canTransition(from, to)) throw new StateError(`Ruxsat etilmagan o'tish: ${from} -> ${to}`, { messageKey: 'error.stateTransition' });
  return to;
}

export default { TRANSITIONS, ALL_STATES, isValidStatus, canTransition, assertTransition };
