// ============================================================
//  core/firebase.js — Firebase (modular SDK) ishga tushirish
//  RTDB compat (vendored, 166KB) o'rniga faqat Auth + Firestore
//  modullari import qilinadi (tree-shaking, kichikroq APK).
//  ADR-001: birlamchi baza — Cloud Firestore.
// ============================================================

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';

import { assertEnv, firebaseConfig, useEmulator } from './env.js';
import { logger } from './logger.js';

// Zarur muhit o'zgaruvchilari mavjudligini boot vaqtida tekshiramiz.
assertEnv();

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Offline persistence ni yoqish
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    logger.warn('Firestore persistence enabled in single-tab mode only (multiple tabs open).');
  } else if (err.code === 'unimplemented') {
    logger.warn('Firestore persistence is unimplemented in this browser.');
  } else {
    logger.warn('Firestore persistence error:', err);
  }
});

// Lokal ishlab chiqish: Firebase Emulator Suite'ga ulanish.
if (useEmulator) {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    logger.info('Firebase Emulator (Auth:9099, Firestore:8080) ga ulandi');
  } catch (e) {
    logger.warn('Emulatorga ulanib bo\'lmadi:', e);
  }
} else {
  logger.info('Firebase (live) ishga tushdi:', firebaseConfig.projectId);
}

export default { app, auth, db };
