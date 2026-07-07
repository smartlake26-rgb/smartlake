// ============================================================
//  features/telemetry/validators/sensorValidators.js
//  Sensor qiymatlarini validatsiya (sof). Imkonsiz o'qishlar
//  (nosoz sensor) null qilinadi -> status "unknown" bo'ladi,
//  yolg'on "critical" emas.
// ============================================================

import { SANE_RANGES } from '../constants/telemetryConstants.js';

function isNum(v) { return typeof v === 'number' && Number.isFinite(v); }

/** Bitta o'qish mantiqiy chegarada (sane) mi? */
export function isSaneReading(field, value) {
  const r = SANE_RANGES[field];
  if (!r) return isNum(value);
  return isNum(value) && value >= r.min && value <= r.max;
}

/**
 * Telemetriyani tozalash: nosoz (sane bo'lmagan) qiymatlar null.
 * ts va boshqa metama'lumotlar saqlanadi.
 */
export function sanitizeTelemetry(tel) {
  if (!tel || typeof tel !== 'object') return tel;
  const out = { ...tel };
  for (const [field, key] of [['do', 'do'], ['ph', 'ph'], ['temp', 't'], ['battery', 'battery'], ['rssi', 'rssi']]) {
    if (out[key] !== undefined && !isSaneReading(field, out[key])) out[key] = null;
  }
  return out;
}

export default { isSaneReading, sanitizeTelemetry };
