// ============================================================
//  features/telemetry/domain/freshness.js
//  Telemetriya yangiligi -> online/offline/pending (sof).
//  Lifecycle FSM'dan alohida (presence hisoblanadi).
// ============================================================

import { DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';

/** Telemetriya yoshi (ms). ts yo'q -> null. */
export function telemetryAge(ts, now = Date.now()) {
  return (typeof ts === 'number' && Number.isFinite(ts)) ? Math.max(0, now - ts) : null;
}

/** online (yangi) / offline (eskirgan) / pending (hech qachon). */
export function presence(ts, now = Date.now(), th = DEFAULT_THRESHOLDS) {
  const age = telemetryAge(ts, now);
  if (age == null) return 'pending';
  return age <= th.offlineMs ? 'online' : 'offline';
}

/** Yangi (fresh) — online deb hisoblash uchun. */
export function isFresh(ts, now = Date.now(), th = DEFAULT_THRESHOLDS) {
  const age = telemetryAge(ts, now);
  return age != null && age <= th.freshMs;
}

export default { telemetryAge, presence, isFresh };
