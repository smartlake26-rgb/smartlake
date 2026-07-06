// ============================================================
//  core/config.js — Ilova bo'ylab konstantalar
//  Asl monolitdan ko'chirilgan HAQIQIY qiymatlar (placeholder emas).
//  Sof modul: bog'liqliksiz, to'g'ridan-to'g'ri test qilinadi.
// ============================================================

/** Real qurilma ma'lumoti "yangi" hisoblanadigan oyna (15 daqiqa). */
export const LIVE_FRESH_MS = 15 * 60 * 1000;

/** O'zbekiston viloyatlari (fermer profili + region menejeri uchun). */
export const VILOYATLAR = Object.freeze([
  'Andijon', 'Buxoro', "Farg'ona", 'Jizzax', 'Xorazm', 'Namangan', 'Navoiy',
  'Qashqadaryo', "Qoraqalpog'iston", 'Samarqand', 'Sirdaryo', 'Surxondaryo',
  'Toshkent viloyati', 'Toshkent shahri',
]);

/**
 * Suv-sifati parametrlari (sazan/carp uchun, O'zbekiston sharoiti).
 * good/warn — chegara funksiyalari (domain qatlami ishlatadi).
 */
export const PARAMS = Object.freeze({
  do: {
    label: 'DO', unit: 'mg/L', dmin: 0, dmax: 12,
    good: (v) => v >= 5,
    warn: (v) => v >= 3,
  },
  ph: {
    label: 'pH', unit: '', dmin: 5, dmax: 10,
    good: (v) => v >= 6.5 && v <= 9.0,
    warn: (v) => v >= 6.0 && v <= 9.5,
  },
  temp: {
    label: 'T', unit: '°C', dmin: 5, dmax: 35,
    good: (v) => v >= 20 && v <= 30,
    warn: (v) => v >= 14 && v <= 34,
  },
});

/** Tarix grafigi oraliqlari: kalit -> ko'rsatiladigan nom. */
export const RANGES = Object.freeze([
  ['1s', '1 soat'], ['6s', '6 soat'], ['24s', '24 soat'],
  ['hafta', 'Hafta'], ['oy', 'Oy'], ['3oy', '3 oy'], ['yil', 'Yil'],
]);

/** Oraliq konfiguratsiyasi: kalit -> [nuqtalar soni, qadam(ms)]. */
export const RANGE_CONF = Object.freeze({
  '1s': [60, 60000],
  '6s': [72, 300000],
  '24s': [96, 900000],
  hafta: [84, 7200000],
  oy: [120, 21600000],
  '3oy': [90, 86400000],
  yil: [122, 259200000],
});

/**
 * Qurilma ID formati: "AQ" + 8 hex belgi (firmware `AQ%08X`).
 * Eslatma: asl ilovadagi 6-belgili placeholder XATO edi —
 * firmware va gateway 8 hex belgi ishlatadi (10 belgi jami).
 */
export const DEVICE_ID_PATTERN = /^AQ[0-9A-F]{8}$/;

/** Qo'llab-quvvatlanadigan tillar. */
export const LOCALES = Object.freeze(['uz', 'ru']);
export const DEFAULT_LOCALE = 'uz';

export default {
  LIVE_FRESH_MS, VILOYATLAR, PARAMS, RANGES, RANGE_CONF,
  DEVICE_ID_PATTERN, LOCALES, DEFAULT_LOCALE,
};
