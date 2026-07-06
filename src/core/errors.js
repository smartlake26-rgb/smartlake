// ============================================================
//  core/errors.js — Tipli xatolar + markaziy xato handleri
//  Maqsad: xatolarni JIMGINA YUTMASLIK (asl ilovadagi bo'sh
//  catch bloklari o'rniga). Har xato:
//    • loglanadi (logger orqali),
//    • foydalanuvchiga ko'rsatish uchun i18n KALITI bilan keladi
//      (matnni UI qatlami `t()` orqali hal qiladi — bu qatlam
//       tildan mustaqil bo'ladi).
// ============================================================

import { logger } from './logger.js';

/** Barcha ilova xatolarining bazasi. */
export class AppError extends Error {
  /**
   * @param {string} message   Dasturchi uchun texnik xabar (log).
   * @param {object} [opts]
   * @param {string} [opts.messageKey]  Foydalanuvchiga ko'rsatiladigan i18n kaliti.
   * @param {string} [opts.code]        Barqaror mashina-o'qiydigan kod.
   * @param {Error}  [opts.cause]       Asl xato (zanjir).
   */
  constructor(message, { messageKey = 'error.generic', code = 'app/unknown', cause } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.messageKey = messageKey;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/** Konfiguratsiya / muhit xatolari (masalan yetishmayotgan env). */
export class ConfigError extends AppError {
  constructor(message, opts = {}) {
    super(message, { messageKey: 'error.config', code: 'app/config', ...opts });
  }
}

/** Autentifikatsiya xatolari. */
export class AuthError extends AppError {
  constructor(message, opts = {}) {
    super(message, { messageKey: 'error.auth', code: 'app/auth', ...opts });
  }
}

/** Holat mashinasi (FSM) qoidasi buzilishi. */
export class StateError extends AppError {
  constructor(message, opts = {}) {
    super(message, { messageKey: 'error.state', code: 'app/state', ...opts });
  }
}

/** Ma'lumotlar (Firestore) qatlami xatolari. */
export class DataError extends AppError {
  constructor(message, opts = {}) {
    super(message, { messageKey: 'error.data', code: 'app/data', ...opts });
  }
}

/**
 * Markaziy xato handleri.
 * Xatoni loglaydi va foydalanuvchiga ko'rsatish uchun i18n kalitini qaytaradi.
 * UI qatlami qaytgan kalitni `t()` orqali matnga aylantiradi.
 *
 * @param {unknown} err
 * @param {string} [context]  Xato qayerda yuz bergani (log uchun).
 * @returns {{ code: string, messageKey: string }}
 */
export function handleError(err, context = '') {
  const where = context ? ` (${context})` : '';

  if (err instanceof AppError) {
    logger.error(`AppError${where}:`, err.code, err.message, err.cause || '');
    return { code: err.code, messageKey: err.messageKey };
  }

  logger.error(`Unhandled error${where}:`, err);
  return { code: 'app/unknown', messageKey: 'error.generic' };
}

export default handleError;
