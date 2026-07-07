// ============================================================
//  features/devices/services/deviceService.js
//  Qurilma provisioning va hayot sikli boshqaruvi (YAGONA Firestore
//  nuqtasi qurilmalar uchun). Provisioning — faqat Super Admin (rules).
//  Har muhim amal auditService orqali qayd qilinadi.
// ============================================================

import { doc, getDoc, setDoc, updateDoc, getDocs, query, where, collection, serverTimestamp } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, DEVICE_LIFECYCLE } from '../../../core/collections.js';
import { DEVICE_ID_PATTERN } from '../../../core/config.js';
import { assertTransition } from '../domain/deviceLifecycle.js';
import { auditService, AUDIT_ACTIONS, AUDIT_TARGETS } from '../../audit/index.js';

function ref(id) { return doc(db, COLLECTIONS.DEVICES, id); }
function wrap(e, ctx) { return e instanceof DataError ? e : new DataError(`${ctx}: ${e && e.message}`, { cause: e }); }

/** Xavfsiz tasodifiy activationKey (qurilma stikeriga bosiladi). */
export function generateActivationKey() {
  const bytes = new Uint8Array(8);
  (globalThis.crypto || crypto).getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export const deviceService = {
  /**
   * Yangi qurilmani provisioning qilish (factory -> provisioned).
   * FAQAT Super Admin (rules). activationKey generatsiya qilinadi va qaytariladi.
   * @param {object} p { deviceId, serialNumber, firmwareVersion, hardwareRevision, region }
   * @param {string} actorUid  amalni bajaruvchi (audit uchun)
   * @returns {Promise<{deviceId, activationKey}>}
   */
  async provision(p, actorUid) {
    const deviceId = String(p.deviceId || '').toUpperCase().trim();
    if (!DEVICE_ID_PATTERN.test(deviceId)) {
      throw new DataError('Device ID formati AQ+8hex bo\'lishi kerak', { messageKey: 'error.deviceIdInvalid' });
    }
    const activationKey = generateActivationKey();
    const data = {
      deviceId,                                   // O'ZGARMAS
      activationKey,                              // maxfiy (fermer o'qiy olmaydi — rules)
      serialNumber: String(p.serialNumber || '').trim(),
      firmwareVersion: String(p.firmwareVersion || '').trim(),
      hardwareRevision: String(p.hardwareRevision || '').trim(),
      region: String(p.region || '').trim(),
      lifecycle: DEVICE_LIFECYCLE.PROVISIONED,    // FSM: factory -> provisioned
      ownerUid: null,
      manufacturedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(ref(deviceId), data);
    } catch (e) { throw wrap(e, 'provision'); }
    auditService.log(AUDIT_ACTIONS.DEVICE_CREATED, {
      actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
      meta: { serialNumber: data.serialNumber, region: data.region },
    });
    logger.info('Qurilma provisioning qilindi:', deviceId);
    return { deviceId, activationKey };
  },

  /** Qurilmani o'qish (yo'q bo'lsa null). */
  async getDevice(deviceId) {
    if (!deviceId) return null;                 // null yo'l -> Firestore'ga bormaymiz
    try {
      const snap = await getDoc(ref(deviceId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (e) { throw wrap(e, 'getDevice'); }
  },

  /**
   * Hayot siklini o'zgartirish (FSM tekshiruvi bilan) — admin.
   * suspended/maintenance/error/active/retired o'tishlari uchun.
   */
  async setLifecycle(deviceId, toState, actorUid) {
    try {
      const snap = await getDoc(ref(deviceId));
      if (!snap.exists()) throw new DataError('Qurilma topilmadi', { messageKey: 'error.deviceNotFound' });
      const from = snap.data().lifecycle;
      assertTransition(from, toState);            // FSM: noto'g'ri o'tish -> StateError
      await updateDoc(ref(deviceId), { lifecycle: toState, updatedAt: serverTimestamp() });
      auditService.log(AUDIT_ACTIONS.STATUS_CHANGED, {
        actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
        meta: { from, to: toState },
      });
      logger.info(`Qurilma holati: ${deviceId} ${from} -> ${toState}`);
    } catch (e) { throw wrap(e, 'setLifecycle'); }
  },

  /** Fermerning qurilmalari (egalik bo'yicha). */
  async listByOwner(uid) {
    try {
      const q = query(collection(db, COLLECTIONS.DEVICES), where('ownerUid', '==', uid));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) { throw wrap(e, 'listByOwner'); }
  },
};

export default deviceService;
