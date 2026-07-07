// ============================================================
//  features/telemetry/domain/sensorStatus.js
//  DO / pH / harorat -> LEVEL (ok/warn/crit/unknown). Sof.
// ============================================================

import { LEVEL, DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** DO: yuqori = yaxshi (<crit -> crit, <warn -> warn). */
export function doStatus(v, th = DEFAULT_THRESHOLDS.do) {
  if (!isNum(v)) return LEVEL.UNKNOWN;
  if (v < th.crit) return LEVEL.CRIT;
  if (v < th.warn) return LEVEL.WARN;
  return LEVEL.OK;
}

/** pH: oraliq (critMin/warnMin..warnMax/critMax). */
export function phStatus(v, th = DEFAULT_THRESHOLDS.ph) {
  if (!isNum(v)) return LEVEL.UNKNOWN;
  if (v < th.critMin || v > th.critMax) return LEVEL.CRIT;
  if (v < th.warnMin || v > th.warnMax) return LEVEL.WARN;
  return LEVEL.OK;
}

/** Harorat: oraliq. */
export function tempStatus(v, th = DEFAULT_THRESHOLDS.temp) {
  if (!isNum(v)) return LEVEL.UNKNOWN;
  if (v < th.critMin || v > th.critMax) return LEVEL.CRIT;
  if (v < th.warnMin || v > th.warnMax) return LEVEL.WARN;
  return LEVEL.OK;
}

export default { doStatus, phStatus, tempStatus };
