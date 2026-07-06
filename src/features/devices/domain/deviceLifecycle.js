// ============================================================
//  features/devices/domain/deviceLifecycle.js
//  Device hayot sikli — CHEKLI HOLAT MASHINASI (FSM).
//  Sof modul (DOM/Firebase'siz) -> to'g'ridan-to'g'ri test qilinadi.
//  Faqat ruxsat etilgan o'tishlarga yo'l qo'yiladi.
// ============================================================

import { DEVICE_LIFECYCLE as S } from '../../../core/collections.js';
import { StateError } from '../../../core/errors.js';

/** Ruxsat etilgan o'tishlar grafi: holat -> [keyingi mumkin holatlar]. */
export const TRANSITIONS = Object.freeze({
  [S.FACTORY]: [S.PROVISIONED, S.RETIRED],
  [S.PROVISIONED]: [S.ASSIGNED, S.RETIRED],
  [S.ASSIGNED]: [S.ACTIVE, S.SUSPENDED, S.MAINTENANCE, S.ERROR, S.RETIRED],
  [S.ACTIVE]: [S.SUSPENDED, S.MAINTENANCE, S.ERROR, S.RETIRED],
  [S.SUSPENDED]: [S.ACTIVE, S.RETIRED],
  [S.MAINTENANCE]: [S.ACTIVE, S.RETIRED],
  [S.ERROR]: [S.ACTIVE, S.MAINTENANCE, S.RETIRED],
  [S.RETIRED]: [],                 // terminal holat
});

/** Barcha holatlar (validatsiya uchun). */
export const ALL_STATES = Object.freeze(Object.values(S));

/** Berilgan qiymat haqiqiy holatmi? */
export function isValidState(state) {
  return ALL_STATES.includes(state);
}

/** from -> to o'tishi ruxsat etilganmi? */
export function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/**
 * O'tishni tekshiradi; ruxsat etilmagan bo'lsa StateError tashlaydi.
 * @returns {string} to (zanjirlash uchun)
 */
export function assertTransition(from, to) {
  if (!isValidState(to)) {
    throw new StateError(`Noma'lum holat: ${to}`, { messageKey: 'error.state' });
  }
  if (!canTransition(from, to)) {
    throw new StateError(`Ruxsat etilmagan o'tish: ${from} -> ${to}`, { messageKey: 'error.stateTransition' });
  }
  return to;
}

export default { TRANSITIONS, ALL_STATES, isValidState, canTransition, assertTransition };
