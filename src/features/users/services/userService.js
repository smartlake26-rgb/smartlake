// ============================================================
//  features/users/services/userService.js
//  users/{uid} hujjati bilan ishlash (YAGONA Firestore nuqtasi).
//  Sxema: { email, role, status, locale, profile:{...}, createdAt, updatedAt }
//  Rollar FAQAT shu hujjatda saqlanadi (custom claim yo'q — ADR qarori).
// ============================================================

import { doc, getDoc, setDoc, updateDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, ROLES, USER_STATUS } from '../../../core/collections.js';
import { DEFAULT_LOCALE } from '../../../core/config.js';

function ref(uid) {
  return doc(db, COLLECTIONS.USERS, uid);
}

function wrap(e, context) {
  return new DataError(`${context}: ${e && e.message}`, { code: 'app/data', cause: e });
}

export const userService = {
  /**
   * Yangi foydalanuvchi hujjati (register paytida).
   * role majburan 'farmer', status 'active' — rules shuni talab qiladi.
   * @returns {Promise<object>} yaratilgan hujjat ma'lumoti
   */
  async createUser(uid, { email, profile, locale }) {
    const data = {
      email: email || null,
      role: ROLES.FARMER,
      status: USER_STATUS.ACTIVE,
      locale: locale || DEFAULT_LOCALE,
      profile: {
        ism: profile.ism.trim(),
        fam: profile.fam.trim(),
        vil: profile.vil,
        tum: (profile.tum || '').trim(),
        phone: (profile.phone || '').trim(),
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(ref(uid), data);
      logger.info('User hujjati yaratildi:', uid);
      return data;
    } catch (e) {
      throw wrap(e, 'createUser');
    }
  },

  /** Foydalanuvchi hujjatini o'qish. Yo'q bo'lsa null. */
  async getUser(uid) {
    try {
      const snap = await getDoc(ref(uid));
      return snap.exists() ? { uid, ...snap.data() } : null;
    } catch (e) {
      throw wrap(e, 'getUser');
    }
  },

  /** Profilni yangilash (faqat profil maydonlari — rules onlyFields). */
  async updateProfile(uid, profile) {
    try {
      await updateDoc(ref(uid), {
        profile: {
          ism: profile.ism.trim(),
          fam: profile.fam.trim(),
          vil: profile.vil,
          tum: (profile.tum || '').trim(),
          phone: (profile.phone || '').trim(),
          photoUrl: profile.photoUrl || null,
        },
        updatedAt: serverTimestamp(),
      });
      logger.info('Profil yangilandi:', uid);
    } catch (e) {
      throw wrap(e, 'updateProfile');
    }
  },

  /** Tilni saqlash. */
  async setLocale(uid, locale) {
    try {
      await updateDoc(ref(uid), { locale, updatedAt: serverTimestamp() });
    } catch (e) {
      throw wrap(e, 'setLocale');
    }
  },

  /** ADMIN (faqat-o'qish): barcha foydalanuvchilar. Rules isAdmin talab qiladi. */
  async listAll() {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.USERS));
      return snap.docs.map((d) => ({ ...d.data(), uid: d.id }));
    } catch (e) { throw wrap(e, 'listAll'); }
  },

  /** ADMIN (isSuper talab qiladi): foydalanuvchi rolini yangilash. */
  async updateRole(uid, role) {
    try {
      await updateDoc(ref(uid), { role, updatedAt: serverTimestamp() });
      logger.info('User roli yangilandi:', uid, role);
    } catch (e) {
      throw wrap(e, 'updateRole');
    }
  },

  /** ADMIN (isSuper talab qiladi): foydalanuvchi statusini yangilash. */
  async updateStatus(uid, status) {
    try {
      await updateDoc(ref(uid), { status, updatedAt: serverTimestamp() });
      logger.info('User statusi yangilandi:', uid, status);
    } catch (e) {
      throw wrap(e, 'updateStatus');
    }
  },

  /** ADMIN (isSuper talab qiladi): region menejerga biriktirilgan viloyatlarni yangilash. */
  async updateRegions(uid, regions) {
    try {
      await updateDoc(ref(uid), { regions, updatedAt: serverTimestamp() });
      logger.info('User regionlari yangilandi:', uid, regions);
    } catch (e) {
      throw wrap(e, 'updateRegions');
    }
  },
};

export default userService;
