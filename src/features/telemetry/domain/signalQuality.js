// ============================================================
//  features/telemetry/domain/signalQuality.js
//  RSSI sifati va batareya salomatligi (sof).
// ============================================================

import { LEVEL, SIGNAL, DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** RSSI (dBm): >=good -> good, >=fair -> fair, aks -> poor. */
export function rssiQuality(v, th = DEFAULT_THRESHOLDS.rssi) {
  if (!isNum(v)) return SIGNAL.UNKNOWN;
  if (v >= th.good) return SIGNAL.GOOD;
  if (v >= th.fair) return SIGNAL.FAIR;
  return SIGNAL.POOR;
}

/** Batareya (%): <crit -> crit, <warn -> warn. */
export function batteryHealth(v, th = DEFAULT_THRESHOLDS.battery) {
  if (!isNum(v)) return LEVEL.UNKNOWN;
  if (v < th.crit) return LEVEL.CRIT;
  if (v < th.warn) return LEVEL.WARN;
  return LEVEL.OK;
}

export default { rssiQuality, batteryHealth };
