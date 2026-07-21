// ============================================================
//  features/telemetry/services/historyService.js
//
//  RTDB-BRIDGE versiyasi. Gateway firmware tarixni RTDB'ga yozadi:
//    nodes/<AQid>/history/<000..287>  -> { do, ph, t, ts }
//  (288 slotli aylanma bufer — 5 daqiqalik interval bilan ~24 soat).
//  Avvalgi kod Firestore'dagi bo'sh telemetry/{id}/history dan
//  o'qirdi. Interfeys AVVALGIDEK: getHistory(deviceId, range).
//  Eslatma: RTDB buferi ~24 soatlik — 7d/30d oraliqlar hozircha
//  buferda bor nuqtalarnigina qaytaradi.
// ============================================================

import { ref, get } from 'firebase/database';

import { rtdb } from '../../../core/firebase.js';
import { DataError } from '../../../core/errors.js';
import { logger } from '../../../core/logger.js';

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
   * @param {'1h'|'24h'|'7d'|'30d'|'365d'} range
   * @returns {Promise<Array<{ts, do, ph, t}>>}  (yo'q bo'lsa [])
   */
  async getHistory(deviceId, range = '24h', now = Date.now()) {
    const span = RANGES[range];
    if (!span) throw new DataError('Noma\'lum oraliq', { messageKey: 'error.generic' });
    if (!deviceId) return [];
    const cutoff = now - span;
    try {
      const snap = await get(ref(rtdb, `nodes/${deviceId}/history`));
      if (!snap.exists()) return [];
      const raw = snap.val() || {};
      // Aylanma bufer: slot tartibi vaqt tartibi EMAS -> ts bo'yicha saralaymiz.
      const points = Object.values(raw)
        .filter((p) => p && typeof p.ts === 'number' && p.ts >= cutoff)
        .sort((a, b) => a.ts - b.ts);
      logger.info(`getHistory(${deviceId}, ${range}): ${points.length} nuqta`);
      return points;
    } catch (e) {
      throw new DataError(`getHistory: ${e && e.message}`, { cause: e });
    }
  },
};

export default historyService;
