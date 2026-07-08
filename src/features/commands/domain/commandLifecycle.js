// ============================================================
//  features/commands/domain/commandLifecycle.js
//  Buyruq status FSM — SOF (Firestore/UI'siz). Markazlashtirilgan.
//  Ruxsat: pending→sent, pending→expired, sent→executed, sent→failed.
// ============================================================

import { COMMAND_STATUS } from '../../../core/collections.js';
import { DataError } from '../../../core/errors.js';

const S = COMMAND_STATUS;

export const TRANSITIONS = Object.freeze({
  [S.PENDING]: [S.SENT, S.EXPIRED],
  [S.SENT]: [S.EXECUTED, S.FAILED],
  [S.EXECUTED]: [],
  [S.FAILED]: [],
  [S.EXPIRED]: [],
});

export const TERMINAL = Object.freeze([S.EXECUTED, S.FAILED, S.EXPIRED]);

export function isValidStatus(s) { return Object.values(S).includes(s); }
export function isTerminal(s) { return TERMINAL.includes(s); }

export function canTransition(from, to) {
  return isValidStatus(from) && isValidStatus(to) && (TRANSITIONS[from] || []).includes(to);
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new DataError(`Noto'g'ri buyruq o'tishi: ${from} -> ${to}`, { messageKey: 'error.badTransition' });
  }
  return to;
}

/** Buyruq eskirganmi (vizual/CF hisob). */
export function isExpired(createdAtMs, status, now = Date.now(), ttlMs = 15 * 60 * 1000) {
  if (status !== S.PENDING && status !== S.SENT) return false;
  if (typeof createdAtMs !== 'number' || !Number.isFinite(createdAtMs)) return false;
  return (now - createdAtMs) > ttlMs;
}

export default { TRANSITIONS, TERMINAL, isValidStatus, isTerminal, canTransition, assertTransition, isExpired };
