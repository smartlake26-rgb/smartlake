// ============================================================
//  features/telemetry/domain/statusEngine.js — Smart Status Engine
//  Qurilma -> Healthy/Good/Warning/Critical/Offline/Unknown (sof).
//  DO/temp/pH/battery/RSSI/telemetry-age asosida avtomatik.
//  Sprint-8 Alarm Engine shu natijadan foydalanadi.
// ============================================================

import { LEVEL, DEVICE_STATUS, DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';
import { doStatus, phStatus, tempStatus } from './sensorStatus.js';
import { batteryHealth } from './signalQuality.js';
import { presence } from './freshness.js';
import { healthScore } from './healthScore.js';

const RANK = { [LEVEL.OK]: 0, [LEVEL.UNKNOWN]: 1, [LEVEL.WARN]: 2, [LEVEL.CRIT]: 3 };

/** Eng yomon sensor darajasi. */
export function worstLevel(tel, th = DEFAULT_THRESHOLDS) {
  const levels = [
    doStatus(tel.do, th.do),
    phStatus(tel.ph, th.ph),
    tempStatus(tel.t, th.temp),
    batteryHealth(tel.battery, th.battery),
  ];
  return levels.reduce((w, l) => (RANK[l] > RANK[w] ? l : w), LEVEL.OK);
}

/**
 * Qurilmaning umumiy smart-statusi.
 * @param {object|null} tel  telemetriya (yoki null)
 * @param {object} th        resolveThresholds
 * @returns {string} DEVICE_STATUS
 */
export function deviceStatus(tel, th = DEFAULT_THRESHOLDS, now = Date.now()) {
  if (!tel || tel.ts == null) return DEVICE_STATUS.UNKNOWN;      // hech qachon ma'lumot yo'q
  if (presence(tel.ts, now, th) === 'offline') return DEVICE_STATUS.OFFLINE;

  const worst = worstLevel(tel, th);
  if (worst === LEVEL.CRIT) return DEVICE_STATUS.CRITICAL;
  if (worst === LEVEL.WARN) return DEVICE_STATUS.WARNING;
  // Barchasi OK: Health Score bo'yicha healthy/good.
  return healthScore(tel, th, now) >= 90 ? DEVICE_STATUS.HEALTHY : DEVICE_STATUS.GOOD;
}

export default deviceStatus;
