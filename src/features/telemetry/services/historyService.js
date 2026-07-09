// ============================================================
//  features/telemetry/services/historyService.js
//  Tarixiy telemetriya (telemetry/{deviceId}/history) so'rovi.
//  Grafik HALI yo'q, lekin servis real ishlaydi va 24h/7d/30d
//  oraliqlarini qo'llab-quvvatlaydi -> Sprint-11 Analytics/grafik
//  shu interfeysdan foydalanadi (biznes kod o'zgarmaydi).
// ============================================================

import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';
import { COLLECTIONS, SUBCOLLECTIONS } from '../../../core/collections.js';

/** Qo'llab-quvvatlanadigan oraliqlar -> ms. */
export const RANGES = Object.freeze({
  '1h': 1 * 3600e3,
  '24h': 24 * 3600e3,
  '7d': 7 * 24 * 3600e3,
  '30d': 30 * 24 * 3600e3,
  '365d': 365 * 24 * 3600e3
});

export const historyService = {
  /**
   * Berilgan qurilma uchun oraliqdagi tarixiy nuqtalar.
   * @param {string} deviceId
   * @param {'24h'|'7d'|'30d'} range
   * @returns {Promise<Array<{ts, do, ph, t}>>}  (yo'q bo'lsa [])
   */
  async getHistory(deviceId, range = '24h', now = Date.now()) {
    const span = RANGES[range];
    if (!span) throw new DataError('Noma\'lum oraliq', { messageKey: 'error.generic' });
    const cutoff = now - span;
    try {
      const q = query(
        collection(db, COLLECTIONS.TELEMETRY, deviceId, SUBCOLLECTIONS.HISTORY),
        where('ts', '>=', cutoff),
        orderBy('ts', 'asc'),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (e) {
      throw new DataError(`getHistory: ${e && e.message}`, { cause: e });
    }
  },
};

export default historyService;
