// ============================================================
//  core/pushService.js — Push Bildirishnomalar Xizmati
//
//  Vazifalar:
//    1. Notification permission so'rash
//    2. FCM token olish va Firestore'ga saqlash (user hujjatiga)
//    3. Foreground (ilova ochiq) bildirishnoma ko'rsatish
//    4. Token yangilash (rotatsiya)
//
//  Ishlatish:
//    import { pushService } from './pushService.js';
//    await pushService.init();          // kirganidan keyin
//    await pushService.requestPermission();  // sozlamalarda toggle
// ============================================================

import { app } from './firebase.js';
import { logger } from './logger.js';
import { toast } from '../shared/toast.js';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { COLLECTIONS } from './collections.js';

let messaging = null;
let currentToken = null;
let unsubForeground = null;

/**
 * FCM messaging instance olish (lazy — faqat kerak bo'lganda yuklanadi)
 */
async function getMessagingInstance() {
  if (messaging) return messaging;
  const { getMessaging, isSupported } = await import('firebase/messaging');
  const supported = await isSupported();
  if (!supported) {
    logger.warn('[PUSH] Bu brauzer push bildirishnomalarni qo\'llab-quvvatlamaydi');
    return null;
  }
  messaging = getMessaging(app);
  return messaging;
}

/**
 * VAPID kaliti — Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
 * Bu kalitni Firebase Console'dan oling va shu yerga qo'ying.
 * Hozircha bo'sh — foydalanuvchi o'zi qo'yishi kerak.
 */
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || '';

export const pushService = {
  /**
   * Push xizmatini ishga tushirish (foydalanuvchi kirgandan keyin)
   * @param {string} uid — foydalanuvchi ID
   */
  async init(uid) {
    if (!uid) return;
    if (!('Notification' in window)) {
      logger.warn('[PUSH] Notification API mavjud emas');
      return;
    }

    // Agar ruxsat allaqachon berilgan bo'lsa — tokenni yangilash
    if (Notification.permission === 'granted') {
      await this._getAndSaveToken(uid);
      this._listenForeground();
    }
  },

  /**
   * Foydalanuvchidan ruxsat so'rash va token olish
   * @param {string} uid
   * @returns {boolean} — ruxsat berildi yoki yo'q
   */
  async requestPermission(uid) {
    if (!('Notification' in window)) {
      toast("Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi", 'err');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        logger.info('[PUSH] Ruxsat berilmadi:', permission);
        toast("Bildirishnomalar ruxsati berilmadi", 'err');
        return false;
      }

      const ok = await this._getAndSaveToken(uid);
      if (ok) {
        this._listenForeground();
        toast("Bildirishnomalar yoqildi ✓", 'ok');
      }
      return ok;
    } catch (e) {
      logger.error('[PUSH] Permission xato:', e);
      toast("Bildirishnoma sozlashda xato", 'err');
      return false;
    }
  },

  /**
   * Push bildirishnomalarni o'chirish
   * @param {string} uid
   */
  async disable(uid) {
    try {
      const m = await getMessagingInstance();
      if (m) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(m);
      }
      // Firestore'dan tokenni o'chirish
      if (uid) {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
          fcmToken: null,
          pushEnabled: false,
          updatedAt: serverTimestamp(),
        });
      }
      currentToken = null;
      if (unsubForeground) { unsubForeground(); unsubForeground = null; }
      logger.info('[PUSH] Bildirishnomalar o\'chirildi');
      toast("Bildirishnomalar o'chirildi", 'ok');
    } catch (e) {
      logger.error('[PUSH] Disable xato:', e);
    }
  },

  /** Hozirgi holat */
  isEnabled() {
    return Notification.permission === 'granted' && !!currentToken;
  },

  /** Ruxsat holati */
  getPermission() {
    return 'Notification' in window ? Notification.permission : 'unsupported';
  },

  // ---- Ichki ----

  async _getAndSaveToken(uid) {
    try {
      const m = await getMessagingInstance();
      if (!m) return false;

      const { getToken } = await import('firebase/messaging');
      const token = await getToken(m, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
          || await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
      });

      if (!token) {
        logger.warn('[PUSH] Token olib bo\'lmadi');
        return false;
      }

      currentToken = token;
      logger.info('[PUSH] FCM token olindi:', token.substring(0, 20) + '...');

      // Firestore user hujjatiga yozish
      if (uid) {
        await updateDoc(doc(db, COLLECTIONS.USERS, uid), {
          fcmToken: token,
          pushEnabled: true,
          pushUpdatedAt: serverTimestamp(),
        });
        logger.info('[PUSH] Token Firestore\'ga saqlandi');
      }

      return true;
    } catch (e) {
      logger.error('[PUSH] Token olishda xato:', e);
      return false;
    }
  },

  _listenForeground() {
    if (unsubForeground) return;

    import('firebase/messaging').then(({ onMessage }) => {
      const m = messaging;
      if (!m) return;

      unsubForeground = onMessage(m, (payload) => {
        logger.info('[PUSH] Foreground xabar:', payload);

        const data = payload.data || {};
        const notification = payload.notification || {};
        const title = notification.title || data.title || 'SmartLake';
        const body = notification.body || data.body || '';

        // In-app toast
        toast(`🔔 ${title}: ${body}`, 'ok');

        // Brauzer notification (ilova ochiq bo'lsa ham)
        if (Notification.permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.svg',
            tag: data.tag || 'smartlake-fg',
          });
        }
      });
    });
  },
};

export default pushService;
