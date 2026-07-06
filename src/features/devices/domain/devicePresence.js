// ============================================================
//  features/devices/domain/devicePresence.js
//  Presence (online/offline/pending) telemetriya `ts` yangiligidan
//  HISOBLANADI — hech qayerda saqlanmaydi (lifecycle FSM'dan alohida).
//  Sof funksiya -> test-oson.
// ============================================================

import { DEVICE_PRESENCE as P } from '../../../core/collections.js';
import { LIVE_FRESH_MS } from '../../../core/config.js';

/**
 * Qurilma presence holatini hisoblaydi.
 * @param {number|null|undefined} latestTs  oxirgi telemetriya vaqti (ms)
 * @param {number} [now=Date.now()]
 * @returns {'online'|'offline'|'pending'}
 *   pending  — hech qachon ma'lumot yubormagan (ts yo'q)
 *   online   — oxirgi ma'lumot LIVE_FRESH_MS ichida
 *   offline  — ma'lumot bor, lekin eskirgan
 */
export function devicePresence(latestTs, now = Date.now()) {
  if (latestTs == null || typeof latestTs !== 'number') return P.PENDING;
  return (now - latestTs) <= LIVE_FRESH_MS ? P.ONLINE : P.OFFLINE;
}

export default devicePresence;
