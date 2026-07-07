// ============================================================
//  features/telemetry/domain/healthScore.js
//  Device Health Score (0-100) — og'irliklangan (sof).
//  DO 35 · temp 20 · pH 20 · battery 10 · rssi 10 · freshness 5.
// ============================================================

import { LEVEL, SIGNAL, HEALTH_WEIGHTS, DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';
import { doStatus, phStatus, tempStatus } from './sensorStatus.js';
import { rssiQuality, batteryHealth } from './signalQuality.js';
import { isFresh } from './freshness.js';

function levelFactor(level) {
  if (level === LEVEL.OK) return 1;
  if (level === LEVEL.WARN) return 0.5;
  if (level === LEVEL.CRIT) return 0;
  return 0;                       // unknown -> 0 (ma'lumot yo'q)
}
function signalFactor(sig) {
  if (sig === SIGNAL.GOOD) return 1;
  if (sig === SIGNAL.FAIR) return 0.5;
  return 0;
}

/**
 * @param {object|null} tel  telemetriya ({do, ph, t, rssi, battery, ts})
 * @param {object} th        resolveThresholds natijasi
 * @returns {number} 0-100 (butun)
 */
export function healthScore(tel, th = DEFAULT_THRESHOLDS, now = Date.now()) {
  if (!tel) return 0;
  const parts = {
    do: levelFactor(doStatus(tel.do, th.do)),
    temp: levelFactor(tempStatus(tel.t, th.temp)),
    ph: levelFactor(phStatus(tel.ph, th.ph)),
    battery: levelFactor(batteryHealth(tel.battery, th.battery)),
    rssi: signalFactor(rssiQuality(tel.rssi, th.rssi)),
    freshness: isFresh(tel.ts, now, th) ? 1 : 0,
  };
  let score = 0;
  for (const k of Object.keys(HEALTH_WEIGHTS)) score += HEALTH_WEIGHTS[k] * parts[k];
  return Math.round(score);
}

export default healthScore;
