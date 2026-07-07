// ============================================================
//  features/telemetry/constants/telemetryConstants.js
//  Telemetriya maydonlari, smart-status va GLOBAL default
//  chegaralar. Ko'l o'z chegarasini override qila oladi
//  (lake.thresholds) -> domain/thresholds.js birlashtiradi.
// ============================================================

/** Firmware'dagi telemetriya maydonlari (telemetry/{deviceId}). */
export const TELEMETRY_FIELDS = Object.freeze({
  DO: 'do', PH: 'ph', TEMP: 't', RSSI: 'rssi', SNR: 'snr',
  BATTERY: 'battery', TS: 'ts', GW_VERSION: 'gwVersion', OWNER: 'ownerUid',
});

/** Sensor daraja (bitta parametr uchun). */
export const LEVEL = Object.freeze({ OK: 'ok', WARN: 'warn', CRIT: 'crit', UNKNOWN: 'unknown' });

/** Qurilmaning umumiy smart-statusi. */
export const DEVICE_STATUS = Object.freeze({
  HEALTHY: 'healthy',
  GOOD: 'good',
  WARNING: 'warning',
  CRITICAL: 'critical',
  OFFLINE: 'offline',
  UNKNOWN: 'unknown',
});

/** RSSI sifat darajasi. */
export const SIGNAL = Object.freeze({ GOOD: 'good', FAIR: 'fair', POOR: 'poor', UNKNOWN: 'unknown' });

/**
 * GLOBAL default chegaralar (baliq ko'llari uchun oqilona qiymatlar).
 * DO mg/L: yuqori = yaxshi. pH/harorat: oraliq. battery %: yuqori = yaxshi.
 * Vaqtlar ms.
 */
export const DEFAULT_THRESHOLDS = Object.freeze({
  do: { crit: 3, warn: 5 },                              // <3 crit, <5 warn
  ph: { critMin: 6.0, warnMin: 6.5, warnMax: 8.5, critMax: 9.0 },
  temp: { critMin: 12, warnMin: 18, warnMax: 30, critMax: 34 },
  battery: { crit: 15, warn: 30 },                       // %
  rssi: { good: -80, fair: -100 },                       // dBm
  freshMs: 15 * 60 * 1000,                               // <15 daq -> online
  offlineMs: 30 * 60 * 1000,                             // >30 daq -> offline
});

/** Sensor sanity chegaralari (imkonsiz qiymatlarni rad etish). */
export const SANE_RANGES = Object.freeze({
  do: { min: 0, max: 25 },
  ph: { min: 0, max: 14 },
  temp: { min: -5, max: 50 },
  battery: { min: 0, max: 100 },
  rssi: { min: -140, max: 0 },
});

/** Health Score og'irliklari (jami 100). */
export const HEALTH_WEIGHTS = Object.freeze({
  do: 35, temp: 20, ph: 20, battery: 10, rssi: 10, freshness: 5,
});

export default {
  TELEMETRY_FIELDS, LEVEL, DEVICE_STATUS, SIGNAL,
  DEFAULT_THRESHOLDS, SANE_RANGES, HEALTH_WEIGHTS,
};
