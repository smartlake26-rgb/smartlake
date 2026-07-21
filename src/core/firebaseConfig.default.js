// ============================================================
//  core/firebaseConfig.default.js — Standart Firebase web config
//  Bu qiymatlar MAXFIY EMAS — Firebase web config har qanday
//  ilovada ochiq ko'rinadi. Asl himoya: Auth + Firestore Rules.
//  Shuning uchun ular committed (GitHub/Vercel build har doim ishlaydi).
//
//  Alohida dev/prod loyihasi yoki white-label kerak bo'lsa —
//  `.env` dagi VITE_FB_* o'zgaruvchilari bu qiymatlarni ustidan
//  yozadi (env.js dagi merge logikasi).
//
//  RTDB-BRIDGE: databaseURL QAYTARILDI — gateway firmware
//  telemetriyani Realtime Database'ga yozadi (nodes/<AQid>/latest),
//  ilova esa shu manzildan o'qiydi (telemetryService RTDB ko'prigi).
// ============================================================

export const DEFAULT_FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyA2JgIbG_kJCLSEjsU142kWyMqTBrUlTdE',
  authDomain: 'smartlake-6ce23.firebaseapp.com',
  databaseURL: 'https://smartlake-6ce23-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'smartlake-6ce23',
  storageBucket: 'smartlake-6ce23.firebasestorage.app',
  messagingSenderId: '920951270016',
  appId: '1:920951270016:web:0c2d2b0032149b08245465',
  measurementId: 'G-L40C0DP1GE',
});

export default DEFAULT_FIREBASE_CONFIG;
