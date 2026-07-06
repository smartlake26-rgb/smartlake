// ============================================================
//  features/auth/services/authService.js
//  Firebase Authentication (email/parol) — YAGONA auth nuqtasi.
//  Barcha foydalanuvchilar (fermer/operator/region/super) shu
//  tizimdan foydalanadi; rol users/{uid} hujjatida (custom claim yo'q).
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload as fbReload,
} from 'firebase/auth';

import { auth } from '../../../core/firebase.js';
import { AuthError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { userService } from '../../users/index.js';

/** Firebase Auth xato kodini i18n kalitiga aylantirish. */
function mapAuthError(code) {
  const c = String(code || '');
  if (c.includes('email-already-in-use')) return 'error.emailInUse';
  if (c.includes('user-not-found')) return 'error.userNotFound';
  if (c.includes('wrong-password') || c.includes('invalid-credential') || c.includes('invalid-login')) return 'error.wrongPassword';
  if (c.includes('invalid-email')) return 'error.emailInvalid';
  if (c.includes('too-many-requests')) return 'error.tooManyRequests';
  if (c.includes('network-request-failed')) return 'error.network';
  return 'error.auth';
}

function wrap(e, context) {
  const messageKey = mapAuthError(e && e.code);
  return new AuthError(`${context}: ${e && e.code}`, { messageKey, code: (e && e.code) || 'app/auth', cause: e });
}

export const authService = {
  /**
   * Ro'yxatdan o'tish: Auth akkaunt + users/{uid} hujjati + tasdiq emaili.
   * @param {string} email
   * @param {string} password
   * @param {{ism, fam, vil, tum?, phone?}} profile
   * @param {string} locale
   * @returns {Promise<import('firebase/auth').User>}
   */
  async register(email, password, profile, locale) {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      throw wrap(e, 'register');
    }
    // Auth akkaunt yaratildi -> Firestore hujjati (rollar shu yerda).
    await userService.createUser(cred.user.uid, { email: cred.user.email, profile, locale });
    // Tasdiq emaili (yumshoq rejim — bloklamaydi).
    try { await sendEmailVerification(cred.user); }
    catch (e) { logger.warn('Tasdiq emailini yuborib bo\'lmadi:', e && e.code); }
    logger.info('Ro\'yxatdan o\'tdi:', cred.user.uid);
    return cred.user;
  },

  async signIn(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      logger.info('Kirdi:', cred.user.uid);
      return cred.user;
    } catch (e) {
      throw wrap(e, 'signIn');
    }
  },

  async signOut() {
    try {
      await fbSignOut(auth);
      logger.info('Chiqdi');
    } catch (e) {
      throw wrap(e, 'signOut');
    }
  },

  /** Parolni tiklash emaili (forgot / settings-da parol o'zgartirish uchun). */
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      logger.info('Parol tiklash emaili yuborildi');
    } catch (e) {
      throw wrap(e, 'resetPassword');
    }
  },

  /** Joriy foydalanuvchiga tasdiq emailini qayta yuborish. */
  async sendVerification() {
    const u = auth.currentUser;
    if (!u) throw new AuthError('sendVerification: foydalanuvchi yo\'q', { messageKey: 'error.auth' });
    try {
      await sendEmailVerification(u);
      logger.info('Tasdiq emaili qayta yuborildi');
    } catch (e) {
      throw wrap(e, 'sendVerification');
    }
  },

  /** Joriy foydalanuvchi holatini yangilash (emailVerified'ni tekshirish). */
  async reload() {
    const u = auth.currentUser;
    if (!u) return null;
    try {
      await fbReload(u);
      return auth.currentUser;
    } catch (e) {
      throw wrap(e, 'reload');
    }
  },

  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  current() {
    return auth.currentUser;
  },
};

export default authService;
