// ============================================================
//  features/ownership/services/ownershipService.js
//  Claim workflow — barcha o'zgarishlar TRANSACTION orqali (atomik,
//  race-safe). Double-claim oldi olinadi: request ID = deviceId
//  (deterministik) + device.ownerUid guard.
//  activationKey Firestore Rules'da tekshiriladi (fermer device'ni
//  o'qiy olmaydi — kalitni ko'rmaydi).
// ============================================================

import {
  doc, setDoc, deleteDoc, getDoc, collection, query, where, onSnapshot, runTransaction, serverTimestamp,
} from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, DEVICE_LIFECYCLE, REQUEST_STATUS, ROLES } from '../../../core/collections.js';
import { assertTransition } from '../../devices/domain/deviceLifecycle.js';
import { auditService, AUDIT_ACTIONS, AUDIT_TARGETS } from '../../audit/index.js';

function wrap(e, ctx) { return e instanceof DataError ? e : new DataError(`${ctx}: ${e && e.message}`, { cause: e }); }

export const ownershipService = {
  /**
   * Fermer qurilmani claim qiladi -> requests/{deviceId} yaratiladi.
   * Rules: activationKey mos kelishini, device egasiz+provisioned ekanini
   * get() bilan tekshiradi. request ID = deviceId -> ikkinchi claim rad etiladi.
   * @param {object} p { deviceId, activationKey, lakeName, farmerRegion }
   * @param {string} actorUid
   */
  async requestClaim(p, actorUid) {
    const deviceId = String(p.deviceId || '').toUpperCase().trim();
    const activationKey = String(p.activationKey || '').toUpperCase().trim();
    if (!deviceId || !activationKey) {
      throw new DataError('deviceId va activationKey majburiy', { messageKey: 'error.claimFields' });
    }
    const reqRef = doc(db, COLLECTIONS.REQUESTS, deviceId);
    try {
      await setDoc(reqRef, {
        deviceId,
        activationKey,                       // rules tekshiradi; tasdiqda o'chiriladi
        uid: actorUid,
        region: String(p.farmerRegion || '').trim(),
        lakeName: String(p.lakeName || '').trim(),
        status: REQUEST_STATUS.PENDING,
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      // Rules rad etsa (noto'g'ri kalit / band / takroriy) -> permission-denied
      throw wrap(e, 'requestClaim');
    }
    auditService.log(AUDIT_ACTIONS.CLAIM_REQUESTED, {
      actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
    });
    logger.info('Claim so\'rovi yaratildi:', deviceId);
  },

  /**
   * Admin claim'ni tasdiqlaydi — ATOMIK transaction:
   *   device.ownerUid=uid + lifecycle=assigned, lake yaratiladi, request o'chiriladi.
   * Race/double-claim: device.ownerUid allaqachon bo'lsa -> abort.
   * @returns {Promise<{lakeId, ownerUid}>}
   */
  async approveClaim(deviceId, actorUid) {
    let result;
    try {
      result = await runTransaction(db, async (tx) => {
        const reqRef = doc(db, COLLECTIONS.REQUESTS, deviceId);
        const devRef = doc(db, COLLECTIONS.DEVICES, deviceId);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new DataError('So\'rov topilmadi', { messageKey: 'error.requestNotFound' });
        const devSnap = await tx.get(devRef);
        if (!devSnap.exists()) throw new DataError('Qurilma topilmadi', { messageKey: 'error.deviceNotFound' });

        const req = reqSnap.data();
        const dev = devSnap.data();
        if (dev.ownerUid) throw new DataError('Qurilma allaqachon biriktirilgan', { messageKey: 'error.alreadyClaimed' });
        assertTransition(dev.lifecycle, DEVICE_LIFECYCLE.ASSIGNED);   // FSM

        const lakeRef = doc(collection(db, COLLECTIONS.LAKES));
        tx.update(devRef, { ownerUid: req.uid, lifecycle: DEVICE_LIFECYCLE.ASSIGNED, updatedAt: serverTimestamp() });
        tx.set(lakeRef, {
          ownerUid: req.uid, deviceId, name: req.lakeName || deviceId,
          region: dev.region, approved: true,
          settings: { minDo: 5, farq: 2, kritik: 3 },
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        tx.delete(reqRef);
        return { lakeId: lakeRef.id, ownerUid: req.uid };
      });
    } catch (e) { throw wrap(e, 'approveClaim'); }

    auditService.log(AUDIT_ACTIONS.CLAIM_APPROVED, {
      actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
      meta: { ownerUid: result.ownerUid, lakeId: result.lakeId },
    });
    auditService.log(AUDIT_ACTIONS.OWNERSHIP_CHANGED, {
      actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
      meta: { newOwner: result.ownerUid },
    });
    logger.info('Claim tasdiqlandi:', deviceId);
    return result;
  },

  /** Admin claim'ni rad etadi — so'rovni o'chiradi + audit. */
  async rejectClaim(deviceId, actorUid) {
    try {
      const reqRef = doc(db, COLLECTIONS.REQUESTS, deviceId);
      const snap = await getDoc(reqRef);
      if (!snap.exists()) throw new DataError('So\'rov topilmadi', { messageKey: 'error.requestNotFound' });
      await deleteDoc(reqRef);
    } catch (e) { throw wrap(e, 'rejectClaim'); }
    auditService.log(AUDIT_ACTIONS.CLAIM_REJECTED, {
      actor: actorUid, targetType: AUDIT_TARGETS.DEVICE, targetId: deviceId,
    });
    logger.info('Claim rad etildi:', deviceId);
  },

  /**
   * Kutilayotgan so'rovlarni realtime kuzatish (admin panel).
   * Rules-mos query: region menejeri FAQAT o'z hududini so'raydi
   * (aks holda o'qib bo'lmaydigan hujjatlar query'ni butunlay rad etadi).
   * @param {{role, regions}} who
   * @param {(requests:Array)=>void} cb
   * @returns {() => void} unsubscribe
   */
  watchRequests(who, cb) {
    let q;
    if (who.role === ROLES.REGION) {
      const regions = (who.regions && who.regions.length ? who.regions : ['__none__']).slice(0, 10);
      q = query(collection(db, COLLECTIONS.REQUESTS), where('region', 'in', regions));
    } else {
      q = query(collection(db, COLLECTIONS.REQUESTS));   // operator/super — hammasi
    }
    return onSnapshot(
      q,
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => { logger.error('watchRequests xato:', err && err.code); cb([]); },
    );
  },
};

export default ownershipService;
