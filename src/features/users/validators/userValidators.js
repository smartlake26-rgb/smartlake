// ============================================================
//  features/users/validators/userValidators.js
//  Profil validatsiyasi (sof funksiyalar, test-oson).
//  ism/fam/viloyat majburiy; tuman/telefon ixtiyoriy.
// ============================================================

import { VILOYATLAR } from '../../../core/config.js';

const PHONE_RE = /^\+?[0-9]{7,15}$/;

export function validateName(value, key) {
  const v = String(value || '').trim();
  if (!v) return { valid: false, messageKey: key };
  if (v.length < 2) return { valid: false, messageKey: key };
  return { valid: true };
}

export function validateRegion(value) {
  const v = String(value || '').trim();
  if (!v) return { valid: false, messageKey: 'error.regionRequired' };
  if (!VILOYATLAR.includes(v)) return { valid: false, messageKey: 'error.regionInvalid' };
  return { valid: true };
}

export function validatePhone(value) {
  const v = String(value || '').trim();
  if (!v) return { valid: true };                     // ixtiyoriy
  const digits = v.replace(/[\s-]/g, '');             // bo'shliq/tire olib tashlanadi
  if (!PHONE_RE.test(digits)) return { valid: false, messageKey: 'error.phoneInvalid' };
  return { valid: true };
}

/**
 * To'liq profil formasi. Birinchi xatoni qaytaradi.
 * @param {{ism, fam, vil, tum?, phone?}} p
 */
export function validateProfile(p = {}) {
  const ism = validateName(p.ism, 'error.firstNameRequired');
  if (!ism.valid) return ism;
  const fam = validateName(p.fam, 'error.lastNameRequired');
  if (!fam.valid) return fam;
  const reg = validateRegion(p.vil);
  if (!reg.valid) return reg;
  const phone = validatePhone(p.phone);
  if (!phone.valid) return phone;
  return { valid: true };
}

export default { validateName, validateRegion, validatePhone, validateProfile };
