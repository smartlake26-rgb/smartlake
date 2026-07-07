// ============================================================
//  features/lakes/services/deviceAssignmentService.js
//  Qurilma <-> Ko'l bog'lanishi — ATOMIK transaction.
//  Qoida: bir qurilma bir vaqtda faqat BITTA ko'lga (device.lakeId).
//          bir ko'lga ko'p qurilma (lake.deviceIds[]) — ko'p-gateway tayyor.
//  Faqat egasi (device va lake bir egaga tegishli).
// ============================================================

import { doc, runTransaction, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, LAKE_STATUS } from '../../../core/collections.js';
import { auditService, AUDIT_ACTIONS, AUDIT_TARGETS } from '../../audit/index.js';

function wrap(e, ctx) { return e instanceof DataError ? e : new DataError(`${ctx}: ${e && e.message}`, { cause: e }); }

export const deviceAssignmentService = {
  /**
   * Qurilmani ko'lga biriktirish (transaction).
   * Guard: device egasiz-ko'l (lakeId==null), device+lake bir egaga tegishli,
   *        ko'l arxivlanmagan. Race-safe (transaction ichida qayta o'qiladi).
   */
  async assign(lakeId, deviceId, owner) {
    try {
      await runTransaction(db, async (tx) => {
        const devRef = doc(db, COLLECTIONS.DEVICES, deviceId);
        const lakeRef = doc(db, COLLECTIONS.LAKES, lakeId);
        const devSnap = await tx.get(devRef);
        const lakeSnap = await tx.get(lakeRef);
        if (!devSnap.exists()) throw new DataError('Qurilma topilmadi', { messageKey: 'error.deviceNotFound' });
        if (!lakeSnap.exists()) throw new DataError('Ko\'l topilmadi', { messageKey: 'error.lakeNotFound' });
        const dev = devSnap.data();
        const lake = lakeSnap.data();
        if (dev.ownerUid !== owner || lake.ownerUid !== owner) throw new DataError('Egalik mos emas', { messageKey: 'error.notOwner' });
        if (dev.lakeId) throw new DataError('Qurilma allaqachon ko\'lga biriktirilgan', { messageKey: 'error.deviceAssigned' });
        if (lake.status === LAKE_STATUS.ARCHIVED) throw new DataError('Ko\'l arxivlangan', { messageKey: 'error.lakeArchived' });

        tx.update(devRef, { lakeId, updatedAt: serverTimestamp() });
        tx.update(lakeRef, { deviceIds: arrayUnion(deviceId), updatedAt: serverTimestamp() });
      });
    } catch (e) { throw wrap(e, 'assign'); }
    auditService.log(AUDIT_ACTIONS.DEVICE_ASSIGNED, {
      actor: owner, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId, meta: { lakeId },
    });
    logger.info(`Qurilma biriktirildi: ${deviceId} -> ${lakeId}`);
  },

  /** Qurilmani ko'ldan ajratish (transaction). */
  async unassign(lakeId, deviceId, owner) {
    try {
      await runTransaction(db, async (tx) => {
        const devRef = doc(db, COLLECTIONS.DEVICES, deviceId);
        const lakeRef = doc(db, COLLECTIONS.LAKES, lakeId);
        const devSnap = await tx.get(devRef);
        const lakeSnap = await tx.get(lakeRef);
        if (!devSnap.exists()) throw new DataError('Qurilma topilmadi', { messageKey: 'error.deviceNotFound' });
        const dev = devSnap.data();
        if (dev.ownerUid !== owner) throw new DataError('Egalik mos emas', { messageKey: 'error.notOwner' });
        if (dev.lakeId !== lakeId) throw new DataError('Qurilma bu ko\'lga biriktirilmagan', { messageKey: 'error.notAssignedHere' });

        tx.update(devRef, { lakeId: null, updatedAt: serverTimestamp() });
        if (lakeSnap.exists()) tx.update(lakeRef, { deviceIds: arrayRemove(deviceId), updatedAt: serverTimestamp() });
      });
    } catch (e) { throw wrap(e, 'unassign'); }
    auditService.log(AUDIT_ACTIONS.DEVICE_UNASSIGNED, {
      actor: owner, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId, meta: { lakeId },
    });
    logger.info(`Qurilma ajratildi: ${deviceId} <- ${lakeId}`);
  },
};

export default deviceAssignmentService;
