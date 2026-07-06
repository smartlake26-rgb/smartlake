// ============================================================
//  features/auth/services/authService.js
//  Firebase Auth (email/parol) bilan real ishlash.
//  • register(): akkaunt + minimal /users/{uid} profil hujjati.
//  • Firebase xato kodlari -> i18n kaliti (jim yutilmaydi).
//  Boy fermer profili + tenant/ownership -> Sprint-3.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import { auth, db } from '../../../core/firebase.js';
import { AuthError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { detectLocale } from '../../../core/i18n/index.js';

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
   * Yangi akkaunt + minimal profil hujjati.
   * @returns {Promise<import('firebase/auth').User>}
   */
  async register(email, password) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      await setDoc(doc(db, 'users', uid), {
        email: cred.user.email,
        locale: detectLocale(),
        createdAt: serverTimestamp(),
      });
      logger.info('Yangi foydalanuvchi yaratildi:', uid);
      return cred.user;
    } catch (e) {
      throw wrap(e, 'register');
    }
  },

  /** Kirish. @returns {Promise<import('firebase/auth').User>} */
  async signIn(email, password) {
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      logger.info('Foydalanuvchi kirdi:', cred.user.uid);
      return cred.user;
    } catch (e) {
      throw wrap(e, 'signIn');
    }
  },

  /** Chiqish. */
  async signOut() {
    try {
      await fbSignOut(auth);
      logger.info('Foydalanuvchi chiqdi');
    } catch (e) {
      throw wrap(e, 'signOut');
    }
  },

  /** Auth holati o'zgarishiga obuna. Unsubscribe qaytaradi. */
  onChange(callback) {
    return onAuthStateChanged(auth, callback);
  },

  /** Joriy foydalanuvchi (yoki null). */
  current() {
    return auth.currentUser;
  },
};

export default authService;
