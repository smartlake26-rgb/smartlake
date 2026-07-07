// ============================================================
//  features/audit/services/auditService.js
//  AUDIT SEAM — biznes kod audit yozuvini FAQAT shu servis orqali
//  qayd qiladi (hech qachon to'g'ridan-to'g'ri `audit` kolleksiyasiga
//  yozmaydi).
//
//  Sprint-4 (vaqtinchalik impl): strukturalangan logger yozuvi.
//    -> Mijoz `audit` kolleksiyasiga YOZMAYDI (ADR qarori).
//  Sprint-7: Cloud Functions (Admin SDK) biznes hujjatlari
//    o'zgarishidan authoritative `audit` yozuvini yaratadi.
//    Bu servis interfeysi (log()) O'ZGARMAYDI -> biznes kod ham.
// ============================================================

import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { COLLECTIONS } from '../../../core/collections.js';
import { logger } from '../../../core/logger.js';

export const auditService = {
  /**
   * Muhim biznes amalini qayd qilish.
   * @param {string} action     AUDIT_ACTIONS dan
   * @param {object} entry
   * @param {string} entry.actor       amalni bajargan uid
   * @param {string} entry.targetType  AUDIT_TARGETS dan
   * @param {string} entry.targetId    obyekt ID (masalan deviceId)
   * @param {object} [entry.meta]      qo'shimcha ma'lumot
   */
  log(action, { actor, targetType, targetId, meta = {} } = {}) {
    const event = {
      action,
      actor: actor || null,
      targetType: targetType || null,
      targetId: targetId || null,
      meta,
      ts: Date.now(),
    };
    // Vaqtinchalik: strukturalangan log. (Sprint-7'da Cloud Function
    // authoritative yozuvni yaratadi — bu chaqiruv joyi o'zgarmaydi.)
    logger.info('[AUDIT]', JSON.stringify(event));
  },

  /**
   * ADMIN (faqat-o'qish): so'nggi audit yozuvlari. Rules: read if isAdmin.
   * Sprint-7'gacha kolleksiya bo'sh -> [] qaytadi (real, placeholder emas).
   */
  async listRecent(max = 100) {
    try {
      const q = query(collection(db, COLLECTIONS.AUDIT), orderBy('ts', 'desc'), limit(max));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
    } catch (e) {
      logger.warn('auditService.listRecent:', e && e.message);
      return [];
    }
  },
};

export default auditService;
