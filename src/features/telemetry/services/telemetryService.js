// ============================================================
//  features/telemetry/services/telemetryService.js
//
//  RTDB-BRIDGE versiyasi. SABAB: gateway firmware telemetriyani
//  Realtime Database'ga yozadi (nodes/<AQid>/latest), avvalgi kod
//  esa Firestore'dagi bo'sh `telemetry` kolleksiyasini tinglardi —
//  shuning uchun ilovada ma'lumot ko'rinmasdi. Firmware O'ZGARMAGAN.
//
//  ISHLASH SXEMASI (tashqi interfeys AVVALGIDEK — dataStore va
//  adminStore'ga tegilmaydi):
//    1) Firestore `devices` dan qurilmalar ro'yxati olinadi
//       (fermer: ownerUid bo'yicha; admin: hammasi) — realtime.
//    2) Har bir qurilma uchun RTDB nodes/<id>/latest tinglanadi.
//    3) Natija Map<deviceId, telemetriya> ko'rinishida emit qilinadi,
//       ownerUid/lakeId Firestore devices hujjatidan qo'shiladi
//       (statusEngine/freshness maydonlari: do, ph, t, rssi, ts — RTDB
//       bilan aynan mos, ts esa ms epoch raqami).
//  unsubscribe() MAJBURIY (memory-leak yo'q).
// ============================================================

import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';

import { db, rtdb } from '../../../core/firebase.js';
import { logger } from '../../../core/logger.js';
import { handleError } from '../../../core/errors.js';
import { COLLECTIONS } from '../../../core/collections.js';
import { sanitizeTelemetry } from '../validators/sensorValidators.js';

/**
 * Umumiy ko'prik: berilgan Firestore devices so'rovi bo'yicha
 * har bir qurilmaning RTDB `latest` yozuvini tinglaydi.
 * @returns {() => void} unsubscribe
 */
function watchDevicesRtdb(devQuery, onData, onError, ctx) {
  const telemetry = new Map();   // deviceId -> tozalangan telemetriya
  const rtdbSubs  = new Map();   // deviceId -> RTDB unsubscribe
  const devMeta   = new Map();   // deviceId -> { ownerUid, lakeId }
  let closed = false;

  const emit = (fromCache = false) => {
    if (closed) return;
    onData({ telemetry: new Map(telemetry), fromCache });
  };

  const unsubDevices = onSnapshot(
    devQuery,
    (snap) => {
      const hozirgi = new Set();
      snap.forEach((d) => {
        const id = d.id;
        hozirgi.add(id);
        const data = d.data() || {};
        devMeta.set(id, { ownerUid: data.ownerUid ?? null, lakeId: data.lakeId ?? null });

        if (!rtdbSubs.has(id)) {
          const r = ref(rtdb, `nodes/${id}/latest`);
          const unsub = onValue(
            r,
            (s) => {
              const v = s.val();
              if (v && typeof v === 'object') {
                const meta = devMeta.get(id) || {};
                telemetry.set(id, sanitizeTelemetry({ ...v, id, ...meta }));
              } else {
                telemetry.delete(id);   // gateway hali yozmagan -> "unknown"
              }
              emit();
            },
            (err) => { handleError(err, `${ctx}.rtdb(${id})`); if (onError) onError(err); },
          );
          rtdbSubs.set(id, unsub);
        }
      });

      // Ro'yxatdan chiqqan qurilmalar (o'chirilgan/egalik bekor) — tozalash
      for (const [id, unsub] of rtdbSubs) {
        if (!hozirgi.has(id)) {
          unsub();
          rtdbSubs.delete(id);
          devMeta.delete(id);
          telemetry.delete(id);
        }
      }
      emit(snap.metadata.fromCache);
    },
    (err) => { handleError(err, `${ctx}.devices`); if (onError) onError(err); },
  );

  return () => {
    closed = true;
    unsubDevices();
    rtdbSubs.forEach((u) => u());
    rtdbSubs.clear();
    devMeta.clear();
    telemetry.clear();
  };
}

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
    const q = query(collection(db, COLLECTIONS.DEVICES), where('ownerUid', '==', ownerUid));
    logger.info('Telemetriya (RTDB) listener ochildi:', ownerUid);
    return watchDevicesRtdb(q, onData, onError, 'telemetryService.watchByOwner');
  },

  /** ADMIN (faqat-o'qish): barcha qurilmalar telemetriyasi realtime. */
  watchAll(onData, onError) {
    logger.info('Admin telemetriya (RTDB) listener ochildi');
    return watchDevicesRtdb(
      collection(db, COLLECTIONS.DEVICES),
      onData, onError, 'telemetryService.watchAll',
    );
  },
};

export default telemetryService;
