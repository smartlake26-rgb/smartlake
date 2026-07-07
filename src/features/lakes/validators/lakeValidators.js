// ============================================================
//  features/lakes/validators/lakeValidators.js
//  Ko'l formasi validatsiyasi (sof). Birinchi xatoni qaytaradi.
//  nom majburiy · koordinata to'g'ri · area>0 · depth>0.
// ============================================================

import { isValidCoordinates } from '../domain/geo.js';

function num(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function validateName(name) {
  const v = String(name || '').trim();
  if (!v) return { valid: false, messageKey: 'error.lakeNameRequired' };
  if (v.length < 2) return { valid: false, messageKey: 'error.lakeNameRequired' };
  return { valid: true };
}

export function validateArea(area) {
  const n = num(area);
  if (n === null || Number.isNaN(n) || n <= 0) return { valid: false, messageKey: 'error.areaPositive' };
  return { valid: true };
}

export function validateDepth(depth) {
  const n = num(depth);
  if (n === null || Number.isNaN(n) || n <= 0) return { valid: false, messageKey: 'error.depthPositive' };
  return { valid: true };
}

/**
 * To'liq ko'l formasi (fermer create/edit).
 * @param {{name, coordinates?, area, averageDepth}} p
 */
export function validateLakeForm(p = {}) {
  const name = validateName(p.name);
  if (!name.valid) return name;
  if (!isValidCoordinates(p.coordinates)) return { valid: false, messageKey: 'error.coordinatesInvalid' };
  const area = validateArea(p.area);
  if (!area.valid) return area;
  const depth = validateDepth(p.averageDepth);
  if (!depth.valid) return depth;
  return { valid: true };
}

export default { validateName, validateArea, validateDepth, validateLakeForm };
