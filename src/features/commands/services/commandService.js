// ============================================================
//  features/commands/services/commandService.js
//  Buyruqlar (YAGONA Firestore nuqtasi). Biznes mantiq domain'da
//  (commandLifecycle FSM). Egalik: faqat qurilma egasi yaratadi
//  (servis + rules). Har amal auditService orqali qayd qilinadi.
// ============================================================

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, COMMAND_STATUS } from '../../../core/collections.js';
import { auditService, AUDIT_ACTIONS, AUDIT_TARGETS } from '../../audit/index.js';
import { assertTransition } from '../domain/commandLifecycle.js';
import { validateCommand } from '../validators/commandValidators.js';
import { buildPayload, COMMAND_TTL_MS } from '../constants/commandConstants.js';

function wrap(e, ctx) { return e instanceof DataError ? e : new DataError(`${ctx}: ${e && e.message}`, { cause: e }); }
function map(d) { return { ...d.data(), id: d.id }; }

const AUDIT_FOR = {
  [COMMAND_STATUS.SENT]: AUDIT_ACTIONS.COMMAND_SENT,
  [COMMAND_STATUS.EXECUTED]: AUDIT_ACTIONS.COMMAND_EXECUTED,
  [COMMAND_STATUS.FAILED]: AUDIT_ACTIONS.COMMAND_FAILED,
  [COMMAND_STATUS.EXPIRED]: AUDIT_ACTIONS.COMMAND_EXPIRED,
};

export const commandService = {
  /**
   * Buyruq yaratish (faqat qurilma egasi). Status = pending.
   * @param {{deviceId, commandType, payload?}} p
   * @param {string} actorUid
   */
  async createCommand({ deviceId, commandType, payload }, actorUid) {
    if (!deviceId || !actorUid) throw new DataError('deviceId/actor majburiy', { messageKey: 'error.generic' });
    const check = validateCommand({ commandType, payload });
    if (!check.valid) throw new DataError('Buyruq validatsiyasi', { messageKey: check.messageKey });

    // Egalik tekshiruvi (rules ham majbur qiladi).
    const devSnap = await getDoc(doc(db, COLLECTIONS.DEVICES, deviceId));
    if (!devSnap.exists()) throw new DataError('Qurilma topilmadi', { messageKey: 'error.deviceNotFound' });
    if (devSnap.data().ownerUid !== actorUid) throw new DataError('Egalik yo\'q', { messageKey: 'error.notOwner' });

    const finalPayload = payload || buildPayload(commandType) || {};
    try {
      const refDoc = await addDoc(collection(db, COLLECTIONS.COMMANDS), {
        deviceId,
        ownerUid: actorUid,
        tenantId: actorUid,                 // tenant = egasi (multi-tenant SaaS)
        commandType,
        payload: finalPayload,
        status: COMMAND_STATUS.PENDING,
        createdAt: serverTimestamp(),
        sentAt: null,
        completedAt: null,
        result: null,
        createdBy: actorUid,
      });
      auditService.log(AUDIT_ACTIONS.COMMAND_CREATED, {
        actor: actorUid, targetType: AUDIT_TARGETS.COMMAND, targetId: refDoc.id, meta: { deviceId, commandType },
      });
      logger.info('Buyruq yaratildi:', commandType, deviceId);
      return refDoc.id;
    } catch (e) { throw wrap(e, 'createCommand'); }
  },

  /** Qurilma bo'yicha buyruqlar (yangi -> eski). */
  async listCommandsByDevice(deviceId, max = 50) {
    try {
      const q = query(collection(db, COLLECTIONS.COMMANDS), where('deviceId', '==', deviceId), orderBy('createdAt', 'desc'), limit(max));
      const snap = await getDocs(q);
      return snap.docs.map(map);
    } catch (e) { throw wrap(e, 'listCommandsByDevice'); }
  },

  /** Egasi bo'yicha buyruqlar. */
  async listCommandsByOwner(uid, max = 100) {
    try {
      const q = query(collection(db, COLLECTIONS.COMMANDS), where('ownerUid', '==', uid), orderBy('createdAt', 'desc'), limit(max));
      const snap = await getDocs(q);
      return snap.docs.map(map);
    } catch (e) { throw wrap(e, 'listCommandsByOwner'); }
  },

  /** Realtime: qurilma buyruqlari (fermer paneli). unsubscribe qaytaradi. */
  subscribeByDevice(deviceId, cb, onError) {
    const q = query(collection(db, COLLECTIONS.COMMANDS), where('deviceId', '==', deviceId), orderBy('createdAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => cb(snap.docs.map(map)), (err) => { logger.error('subscribeByDevice:', err && err.code); if (onError) onError(err); });
  },

  /** Realtime: barcha buyruqlar (ADMIN — rules isAdmin). */
  subscribeAll(cb, onError) {
    const q = query(collection(db, COLLECTIONS.COMMANDS), orderBy('createdAt', 'desc'), limit(300));
    return onSnapshot(q, (snap) => cb(snap.docs.map(map)), (err) => { logger.error('subscribeAll:', err && err.code); if (onError) onError(err); });
  },

  /**
   * Status o'tishi (imtiyozli kontekst: device/admin/CF — rules).
   * FSM majburlaydi. sentAt/completedAt/result yoziladi. Audit.
   */
  async updateCommandStatus(commandId, toStatus, { result = null } = {}, actorUid = null) {
    try {
      const ref = doc(db, COLLECTIONS.COMMANDS, commandId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new DataError('Buyruq topilmadi', { messageKey: 'error.generic' });
      const cur = snap.data();
      assertTransition(cur.status, toStatus);              // domain FSM

      const patch = { status: toStatus };
      if (toStatus === COMMAND_STATUS.SENT) patch.sentAt = serverTimestamp();
      if ([COMMAND_STATUS.EXECUTED, COMMAND_STATUS.FAILED, COMMAND_STATUS.EXPIRED].includes(toStatus)) {
        patch.completedAt = serverTimestamp();
        patch.result = result;
      }
      await updateDoc(ref, patch);

      const action = AUDIT_FOR[toStatus];
      if (action) auditService.log(action, { actor: actorUid, targetType: AUDIT_TARGETS.COMMAND, targetId: commandId, meta: { deviceId: cur.deviceId, from: cur.status } });
      logger.info('Buyruq statusi:', commandId, cur.status, '->', toStatus);
      return toStatus;
    } catch (e) { throw wrap(e, 'updateCommandStatus'); }
  },

  /**
   * Eskirgan pending buyruqlarni expired qilish (imtiyozli: admin/CF).
   * Rules fermerga update bermaydi -> bu privileged kontekstda ishlaydi.
   */
  async expireOldCommands({ ttlMs = COMMAND_TTL_MS, now = Date.now(), actorUid = null } = {}) {
    try {
      const q = query(collection(db, COLLECTIONS.COMMANDS), where('status', '==', COMMAND_STATUS.PENDING));
      const snap = await getDocs(q);
      const cutoff = now - ttlMs;
      let expired = 0;
      for (const d of snap.docs) {
        const c = d.data();
        const createdMs = c.createdAt && typeof c.createdAt.toMillis === 'function' ? c.createdAt.toMillis() : null;
        if (createdMs != null && createdMs < cutoff) {
          await this.updateCommandStatus(d.id, COMMAND_STATUS.EXPIRED, { result: 'ttl' }, actorUid);
          expired += 1;
        }
      }
      logger.info('expireOldCommands: eskirgan =', expired);
      return expired;
    } catch (e) { throw wrap(e, 'expireOldCommands'); }
  },
};

export default commandService;
