// ============================================================
//  features/telemetry/domain/thresholds.js
//  Global default + ko'l override birlashtiruvchi (sof).
//  lake.thresholds mavjud bo'lsa, default ustiga qo'yiladi.
// ============================================================

import { DEFAULT_THRESHOLDS } from '../constants/telemetryConstants.js';

/** Ikki daraja chuqurlikda birlashtirish (default <- override). */
export function resolveThresholds(lake) {
  const o = (lake && lake.thresholds) || {};
  const out = {};
  for (const k of Object.keys(DEFAULT_THRESHOLDS)) {
    const d = DEFAULT_THRESHOLDS[k];
    if (d && typeof d === 'object') out[k] = { ...d, ...(o[k] || {}) };
    else out[k] = o[k] != null ? o[k] : d;
  }
  return out;
}

export default resolveThresholds;
