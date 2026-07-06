// ============================================================
//  core/i18n/index.js — Markazlashgan i18n dvigateli
//  Kodda ko'rinadigan matn QATTIQ yozilmaydi — `t('kalit')` orqali.
//  Asosiy til: uz. Qo'shimcha: ru. Yo'q kalit -> uz fallback -> kalit.
//  Bu i18n va (kelajakda) white-label uchun bir vaqtda ishlaydi.
// ============================================================

import { uz } from './uz.js';
import { ru } from './ru.js';
import { LOCALES, DEFAULT_LOCALE } from '../config.js';
import { logger } from '../logger.js';

const CATALOG = { uz, ru };

let current = DEFAULT_LOCALE;
const listeners = new Set();

/** Ichma-ich obyektdan "a.b.c" yo'l bo'yicha qiymat olish. */
function lookup(dict, key) {
  return key.split('.').reduce((o, part) => (o && o[part] != null ? o[part] : undefined), dict);
}

/** {param} shablonlarini to'ldirish. */
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, name) => (params[name] != null ? String(params[name]) : m));
}

/**
 * Tarjima. Kalit topilmasa: uz fallback, u ham bo'lmasa kalitning o'zi.
 * @param {string} key
 * @param {object} [params]
 * @returns {string}
 */
export function t(key, params) {
  let val = lookup(CATALOG[current], key);
  if (val == null && current !== DEFAULT_LOCALE) {
    val = lookup(CATALOG[DEFAULT_LOCALE], key);
  }
  if (val == null) {
    logger.warn(`i18n: kalit topilmadi: "${key}" (til: ${current})`);
    return key;
  }
  return interpolate(val, params);
}

/** Joriy til. */
export function getLocale() {
  return current;
}

/** Tilni o'zgartirish (faqat qo'llab-quvvatlanadiganlar). */
export function setLocale(locale) {
  if (!LOCALES.includes(locale)) {
    logger.warn(`i18n: qo'llab-quvvatlanmaydigan til: ${locale}`);
    return;
  }
  if (locale === current) return;
  current = locale;
  listeners.forEach((fn) => fn(locale));
}

/** Til o'zgarishiga obuna (UI qayta render qilishi uchun). Unsubscribe qaytaradi. */
export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Foydalanuvchi profili yoki brauzer tilidan boshlang'ich tilni aniqlash.
 * @param {string} [preferred]  Profildagi til (bo'lsa ustun).
 */
export function detectLocale(preferred) {
  if (preferred && LOCALES.includes(preferred)) return preferred;
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  const short = nav.slice(0, 2).toLowerCase();
  return LOCALES.includes(short) ? short : DEFAULT_LOCALE;
}

export default { t, getLocale, setLocale, onLocaleChange, detectLocale };
