// ============================================================
//  features/lakes/services/lakeService.js
//  Ko'l boshqaruvi (YAGONA Firestore nuqtasi ko'llar uchun).
//  SOLID: validatsiya -> validators, holat -> domain FSM, audit -> seam.
//  Soft-delete: archive (fizik delete YO'Q).
// ============================================================

import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, query, where, serverTimestamp,
} from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, LAKE_STATUS } from '../../../core/collections.js';
import { assertTransition } from '../domain/lakeStatus.js';
import { validateLakeForm } from '../validators/lakeValidators.js';
import { auditService, AUDIT_ACTIONS, AUDIT_TARGETS } from '../../audit/index.js';

function ref(id) { return doc(db, COLLECTIONS.LAKES, id); }
function wrap(e, ctx) { return e instanceof DataError ? e : new DataError(`${ctx}: ${e && e.message}`, { cause: e }); }

/** Formadan xavfsiz lake tanasini quradi (ruxsat etilgan maydonlar). */
function buildProfile(p) {
  return {
    name: String(p.name || '').trim(),
    description: String(p.description || '').trim(),
    district: String(p.district || '').trim(),
    coordinates: p.coordinates && p.coordinates.lat != null
      ? { lat: Number(p.coordinates.lat), lng: Number(p.coordinates.lng) } : null,
    area: p.area != null && p.area !== '' ? Number(p.area) : null,
    averageDepth: p.averageDepth != null && p.averageDepth !== '' ? Number(p.averageDepth) : null,
    waterVolume: p.waterVolume != null && p.waterVolume !== '' ? Number(p.waterVolume) : null,
    fishSpecies: Array.isArray(p.fishSpecies) ? p.fishSpecies : [],
  };
}

export const lakeService = {
  /**
   * Ko'l yaratish (fermer mustaqil). Validatsiya -> audit.
   * @returns {Promise<{lakeId}>}
   */
  async create(p, owner, region) {
    const check = validateLakeForm(p);
    if (!check.valid) throw new DataError('Ko\'l formasi xato', { messageKey: check.messageKey });
    const lakeRef = doc(collection(db, COLLECTIONS.LAKES));
    const data = {
      ownerUid: owner,
      region: String(region || '').trim(),
      ...buildProfile(p),
      deviceIds: [],
      status: LAKE_STATUS.ACTIVE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      archivedAt: null,
    };
    try { await setDoc(lakeRef, data); } catch (e) { throw wrap(e, 'create'); }
    auditService.log(AUDIT_ACTIONS.LAKE_CREATED, { actor: owner, targetType: AUDIT_TARGETS.LAKE, targetId: lakeRef.id });
    logger.info('Ko\'l yaratildi:', lakeRef.id);
    return { lakeId: lakeRef.id };
  },

  /** Ko'l profilini tahrirlash (egasi). Validatsiya -> audit. */
  async update(lakeId, p, owner) {
    const check = validateLakeForm(p);
    if (!check.valid) throw new DataError('Ko\'l formasi xato', { messageKey: check.messageKey });
    try {
      await updateDoc(ref(lakeId), { ...buildProfile(p), updatedAt: serverTimestamp() });
    } catch (e) { throw wrap(e, 'update'); }
    auditService.log(AUDIT_ACTIONS.LAKE_UPDATED, { actor: owner, targetType: AUDIT_TARGETS.LAKE, targetId: lakeId });
    logger.info('Ko\'l tahrirlandi:', lakeId);
  },

  /** Soft-delete: arxivlash (fizik delete emas). */
  async archive(lakeId, owner) {
    try {
      const snap = await getDoc(ref(lakeId));
      if (!snap.exists()) throw new DataError('Ko\'l topilmadi', { messageKey: 'error.lakeNotFound' });
      assertTransition(snap.data().status, LAKE_STATUS.ARCHIVED);
      await updateDoc(ref(lakeId), { status: LAKE_STATUS.ARCHIVED, archivedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } catch (e) { throw wrap(e, 'archive'); }
    auditService.log(AUDIT_ACTIONS.LAKE_ARCHIVED, { actor: owner, targetType: AUDIT_TARGETS.LAKE, targetId: lakeId });
    logger.info('Ko\'l arxivlandi:', lakeId);
  },

  /** Faollashtirish/deaktivatsiya (active <-> inactive) FSM bilan. */
  async setStatus(lakeId, toStatus, owner) {
    try {
      const snap = await getDoc(ref(lakeId));
      if (!snap.exists()) throw new DataError('Ko\'l topilmadi', { messageKey: 'error.lakeNotFound' });
      const from = snap.data().status;
      assertTransition(from, toStatus);
      await updateDoc(ref(lakeId), { status: toStatus, updatedAt: serverTimestamp() });
      auditService.log(AUDIT_ACTIONS.LAKE_STATUS_CHANGED, {
        actor: owner, targetType: AUDIT_TARGETS.LAKE, targetId: lakeId, meta: { from, to: toStatus },
      });
    } catch (e) { throw wrap(e, 'setStatus'); }
  },

  async getLake(lakeId) {
    if (!lakeId) return null;
    try {
      const snap = await getDoc(ref(lakeId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    } catch (e) { throw wrap(e, 'getLake'); }
  },

  /** Fermerning ko'llari (arxivlanganlar ixtiyoriy). */
  async listByOwner(owner, { includeArchived = false } = {}) {
    try {
      const q = query(collection(db, COLLECTIONS.LAKES), where('ownerUid', '==', owner));
      const snap = await getDocs(q);
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return includeArchived ? all : all.filter((l) => l.status !== LAKE_STATUS.ARCHIVED);
    } catch (e) { throw wrap(e, 'listByOwner'); }
  },
};

export default lakeService;
