// ============================================================
//  features/telemetry/services/telemetryService.js
//  Realtime telemetriya — Firestore snapshot listener.
//  FAQAT ownerUid bo'yicha (global listener YO'Q). Bitta listener
//  fermerning barcha qurilmalarini qamraydi -> minimal Firestore read.
//  unsubscribe() MAJBURIY (memory-leak yo'q). Offline: metadata.fromCache.
//  5000+/10000+ ga tayyor: har fermer faqat o'z kichik to'plamini tinglaydi.
// ============================================================

import { collection, query, where, onSnapshot } from 'firebase/firestore';

import { db } from '../../../core/firebase.js';
import { logger } from '../../../core/logger.js';
import { handleError } from '../../../core/errors.js';
import { COLLECTIONS } from '../../../core/collections.js';
import { sanitizeTelemetry } from '../validators/sensorValidators.js';

export const telemetryService = {
  /**
   * Fermerning barcha qurilmalari telemetriyasini realtime tinglash.
   * @param {string} ownerUid
   * @param {(payload:{telemetry:Map<string,object>, fromCache:boolean})=>void} onData
   * @param {(err)=>void} [onError]
   * @returns {() => void} unsubscribe — MAJBURIY chaqirilsin
   */
  watchByOwner(ownerUid, onData, onError) {
    if (!ownerUid) {
      logger.warn('telemetryService: ownerUid yo\'q — listener ochilmadi');
      return () => {};
    }
    const q = query(collection(db, COLLECTIONS.TELEMETRY), where('ownerUid', '==', ownerUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const telemetry = new Map();
        snap.forEach((d) => telemetry.set(d.id, sanitizeTelemetry({ ...d.data(), id: d.id })));
        onData({ telemetry, fromCache: snap.metadata.fromCache });
      },
      (err) => {
        handleError(err, 'telemetryService.watchByOwner');
        if (onError) onError(err);
      },
    );
    logger.info('Telemetriya listener ochildi:', ownerUid);
    return unsub;
  },

  /** ADMIN (faqat-o'qish): butun telemetriya kolleksiyasi realtime. Rules isAdmin. */
  watchAll(onData, onError) {
    const unsub = onSnapshot(
      collection(db, COLLECTIONS.TELEMETRY),
      (snap) => {
        const telemetry = new Map();
        snap.forEach((d) => telemetry.set(d.id, { ...d.data(), id: d.id }));
        onData({ telemetry, fromCache: snap.metadata.fromCache });
      },
      (err) => { handleError(err, 'telemetryService.watchAll'); if (onError) onError(err); },
    );
    logger.info('Admin telemetriya listener ochildi');
    return unsub;
  },
};

export default telemetryService;
