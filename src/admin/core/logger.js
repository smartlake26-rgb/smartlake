// ============================================================
//  core/logger.js — Darajali production logger
//  Asl ilovada logging umuman yo'q edi. Bu modul barcha
//  qatlamlar uchun yagona, izchil log nuqtasini beradi.
//  DEV rejimida hammasi konsolga chiqadi; PROD'da `debug`
//  bostiriladi va kelajakda tashqi log (masalan Analytics/
//  Crashlytics) ga ulanadigan yagona nuqta shu yerda bo'ladi.
// ============================================================

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// Vite `import.meta.env.DEV` ni build vaqtida to'ldiradi.
const IS_DEV = typeof import.meta !== 'undefined'
  && import.meta.env
  && import.meta.env.DEV === true;

// PROD'da `info` va yuqorisi; DEV'da hammasi.
let threshold = IS_DEV ? LEVELS.debug : LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const prefix = `[${ts()}] [${level.toUpperCase()}]`;
  // eslint-disable-next-line no-console
  const fn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : console.log;
  fn(prefix, ...args);
}

export const logger = {
  debug: (...a) => emit('debug', a),
  info: (...a) => emit('info', a),
  warn: (...a) => emit('warn', a),
  error: (...a) => emit('error', a),

  /** Test yoki maxsus holatlar uchun darajani o'zgartirish. */
  setLevel(level) {
    if (LEVELS[level] != null) threshold = LEVELS[level];
  },
};

export default logger;
