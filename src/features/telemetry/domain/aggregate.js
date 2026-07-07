// ============================================================
//  features/telemetry/domain/aggregate.js
//  Ko'l bo'yicha jamlash (sof): avg DO/temp/pH, online/offline,
//  Health Score, eng yomon status, oxirgi yangilanish, alarm.
// ============================================================

import { DEVICE_STATUS, DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';
import { presence } from './freshness.js';
import { healthScore } from './healthScore.js';
import { deviceStatus } from './statusEngine.js';

function avg(nums) {
  const arr = nums.filter((n) => typeof n === 'number' && Number.isFinite(n));
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
}

const SEVERITY = {
  [DEVICE_STATUS.CRITICAL]: 5, [DEVICE_STATUS.WARNING]: 4, [DEVICE_STATUS.OFFLINE]: 3,
  [DEVICE_STATUS.UNKNOWN]: 2, [DEVICE_STATUS.GOOD]: 1, [DEVICE_STATUS.HEALTHY]: 0,
};

/**
 * @param {Array} devices  ko'lga tegishli qurilmalar [{id,...}]
 * @param {Map|object} telByDevice  deviceId -> telemetriya
 * @param {object} th  resolveThresholds
 * @returns {object} agregat
 */
export function aggregateLake(devices, telByDevice, th = DEFAULT_THRESHOLDS, now = Date.now()) {
  const get = (id) => (telByDevice instanceof Map ? telByDevice.get(id) : telByDevice[id]) || null;
  let online = 0, offline = 0, lastUpdate = null, worst = DEVICE_STATUS.HEALTHY, hasAlarm = false;
  const dos = [], temps = [], phs = [], scores = [];

  for (const d of devices) {
    const tel = get(d.id);
    const pres = tel ? presence(tel.ts, now, th) : 'pending';
    if (pres === 'online') online += 1; else offline += 1;
    if (tel) {
      dos.push(tel.do); temps.push(tel.t); phs.push(tel.ph);
      scores.push(healthScore(tel, th, now));
      if (typeof tel.ts === 'number') lastUpdate = lastUpdate == null ? tel.ts : Math.max(lastUpdate, tel.ts);
    }
    const st = deviceStatus(tel, th, now);
    if (SEVERITY[st] > SEVERITY[worst]) worst = st;
    if (st === DEVICE_STATUS.CRITICAL || st === DEVICE_STATUS.WARNING) hasAlarm = true;
  }

  return {
    deviceCount: devices.length,
    online,
    offline,
    avgDo: avg(dos),
    avgTemp: avg(temps),
    avgPh: avg(phs),
    lastUpdate,
    healthScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    status: devices.length ? worst : DEVICE_STATUS.UNKNOWN,
    hasAlarm,
  };
}

export default aggregateLake;
