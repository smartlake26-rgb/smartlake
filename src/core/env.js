// ============================================================
//  core/env.js — Muhit config: committed default + ixtiyoriy override
//  Firebase web config maxfiy emas -> committed default (build har
//  doim ishlaydi, hatto .env bo'lmasa ham: masalan Vercel'da).
//  VITE_FB_* o'zgaruvchilari (bo'lsa) default'ni ustidan yozadi.
//
//  RTDB-BRIDGE: databaseURL merge'ga qo'shildi (VITE_FB_DATABASE_URL
//  bilan override qilinishi mumkin).
// ============================================================

import { ConfigError } from './errors.js';
import { DEFAULT_FIREBASE_CONFIG } from './firebaseConfig.default.js';

function raw(key) {
  if (typeof import.meta !== 'undefined' && import.meta.env && key in import.meta.env) {
    return import.meta.env[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
}

/** Env qiymati bo'lsa uni, bo'lmasa fallback'ni qaytaradi. */
function val(key, fallback) {
  const v = raw(key);
  return (v == null || String(v).trim() === '') ? fallback : v;
}

/** Firebase konfiguratsiyasi: default ustiga env override. */
export const firebaseConfig = Object.freeze({
  apiKey: val('VITE_FB_API_KEY', DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: val('VITE_FB_AUTH_DOMAIN', DEFAULT_FIREBASE_CONFIG.authDomain),
  databaseURL: val('VITE_FB_DATABASE_URL', DEFAULT_FIREBASE_CONFIG.databaseURL),
  projectId: val('VITE_FB_PROJECT_ID', DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: val('VITE_FB_STORAGE_BUCKET', DEFAULT_FIREBASE_CONFIG.storageBucket),
  messagingSenderId: val('VITE_FB_MESSAGING_SENDER_ID', DEFAULT_FIREBASE_CONFIG.messagingSenderId),
  appId: val('VITE_FB_APP_ID', DEFAULT_FIREBASE_CONFIG.appId),
  measurementId: val('VITE_FB_MEASUREMENT_ID', DEFAULT_FIREBASE_CONFIG.measurementId),
});

/**
 * Yakuniy (merge qilingan) config to'liqligini tekshiradi.
 * Default committed bo'lgani uchun normal holatda hech qachon
 * xato bermaydi; faqat kimdir default'ni ham, env'ni ham bo'shatsa.
 */
export function assertEnv() {
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  const missing = required.filter((k) => !firebaseConfig[k] || String(firebaseConfig[k]).trim() === '');
  if (missing.length) {
    throw new ConfigError(`Firebase config to'liq emas: ${missing.join(', ')}`);
  }
}

export const useEmulator = String(raw('VITE_USE_EMULATOR')).toLowerCase() === 'true';

export const isDev = typeof import.meta !== 'undefined'
  && import.meta.env
  && import.meta.env.DEV === true;

export default { assertEnv, firebaseConfig, useEmulator, isDev };
