// ============================================================
//  core/env.js — Muhit o'zgaruvchilarini o'qish va TEKSHIRISH
//  Firebase kalitlari .env dan keladi (manba kodda emas).
//  Zarur o'zgaruvchi yetishmasa — boot vaqtida aniq ConfigError.
// ============================================================

import { ConfigError } from './errors.js';

function raw(key) {
  // Vite mijoz kodida import.meta.env; Node/test'da process.env.
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

const REQUIRED = [
  'VITE_FB_API_KEY',
  'VITE_FB_AUTH_DOMAIN',
  'VITE_FB_PROJECT_ID',
  'VITE_FB_APP_ID',
];

/**
 * Zarur o'zgaruvchilarni tekshiradi. Yetishmayotganlar bo'lsa
 * ConfigError tashlaydi (ro'yxat bilan).
 */
export function assertEnv() {
  const missing = REQUIRED.filter((k) => {
    const v = raw(k);
    return v == null || String(v).trim() === '';
  });
  if (missing.length) {
    throw new ConfigError(
      `Yetishmayotgan muhit o'zgaruvchilari: ${missing.join(', ')}. ` +
      `\`.env.example\` ni \`.env\` ga nusxalang.`,
    );
  }
}

/** Firebase SDK uchun konfiguratsiya obyekti. */
export const firebaseConfig = Object.freeze({
  apiKey: raw('VITE_FB_API_KEY'),
  authDomain: raw('VITE_FB_AUTH_DOMAIN'),
  projectId: raw('VITE_FB_PROJECT_ID'),
  storageBucket: raw('VITE_FB_STORAGE_BUCKET'),
  messagingSenderId: raw('VITE_FB_MESSAGING_SENDER_ID'),
  appId: raw('VITE_FB_APP_ID'),
  measurementId: raw('VITE_FB_MEASUREMENT_ID'),
});

/** Lokal emulatordan foydalanish kerakmi? */
export const useEmulator = String(raw('VITE_USE_EMULATOR')).toLowerCase() === 'true';

/** DEV rejimimi? */
export const isDev = typeof import.meta !== 'undefined'
  && import.meta.env
  && import.meta.env.DEV === true;

export default { assertEnv, firebaseConfig, useEmulator, isDev };
