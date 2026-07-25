// ============================================================
//  features/telemetry/services/archiveService.js — TARIX ARXIVI (B-bosqich)
//
//  MUAMMO: qurilma buferi ~24 soatlik (RTDB nodes/<id>/history).
//  YECHIM: ilova ochiq turganda kelayotgan telemetriyani Firestore'ga
//  kunlik hujjatlarga arxivlab boradi — hafta/oy/yil tarixi shu yerdan.
//  Firmware'ga TEGILMAGAN — bu faqat ilova qatlami (topshiriq qoidasi).
//
//  Ma'lumot modeli:  telemetryArchive/{deviceId}_{YYYY-MM-DD}
//    { deviceId, ownerUid, dayKey, updatedAt, samples: [{ts,do,t,ph,aer,rssi,battery}] }
//  Yozish: har qurilma uchun ko'pi bilan ~4.5 daqiqada bir sample
//  (telemetriya davri 5 daq — deyarli har kadr saqlanadi, doc yiliga emas,
//   kuniga bitta: ~288 sample/kun, hajm xavfsiz).
//
//  Elektr hisobi: sample'lardagi `aer` (rele holati) dan ish vaqti
//  taxminan tiklanadi: ketma-ket sample'lar orasi (max 10 daq) aer=1
//  bo'lsa qo'shiladi. kWh = soat × kW (kW foydalanuvchi kiritadi).
// ============================================================

import {
  doc, setDoc, getDoc, collection, query, where, getDocs,
  arrayUnion, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../core/firebase.js';
import { logger } from '../../../core/logger.js';

const THROTTLE_MS = 4.5 * 60 * 1000;   // qurilma boshiga yozish oralig'i
const MAX_GAP_MS = 10 * 60 * 1000;     // aer ish vaqtida hisoblanadigan maks oraliq

/** Lokal kun kaliti: YYYY-MM-DD. */
export function dayKey(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ------------------------------------------------------------
//  YOZUVCHI (archiver) — dataStore obunasi orqali
// ------------------------------------------------------------
let started = false;
const lastWrite = new Map();   // deviceId -> {ts, wroteAt}

export function startArchiver(dataStoreModule, uid) {
  if (started || !uid) return;
  started = true;

  // 1. Real-time: telemetriya kelganda arxivlash
  dataStoreModule.subscribe((st) => {
    if (!st || !st.telemetry || !st.telemetry.forEach) return;
    st.telemetry.forEach((tel, deviceId) => {
      if (!tel || typeof tel.ts !== 'number') return;
      const prev = lastWrite.get(deviceId);
      const now = Date.now();
      if (prev && (prev.ts === tel.ts || now - prev.wroteAt < THROTTLE_MS)) return;
      lastWrite.set(deviceId, { ts: tel.ts, wroteAt: now });

      const sample = { ts: tel.ts };
      for (const k of ['do', 't', 'ph', 'aer', 'rssi', 'battery']) {
        if (typeof tel[k] === 'number' && Number.isFinite(tel[k])) sample[k] = tel[k];
      }
      const dk = dayKey(tel.ts);
      setDoc(doc(db, 'telemetryArchive', `${deviceId}_${dk}`), {
        deviceId, ownerUid: uid, dayKey: dk,
        updatedAt: serverTimestamp(),
        samples: arrayUnion(sample),
      }, { merge: true }).catch((e) => logger.warn('arxiv yozish:', e && e.message));
    });
  });

  // 2. RTDB history buferdan o'tgan ma'lumotlarni arxivlash (bir martalik)
  //    Ilova ochilganda RTDB'dagi 24h history'ni Firestore'ga yozadi
  //    Bu yo'qolgan ma'lumotlarni tiklash uchun
  setTimeout(() => {
    backfillFromRtdb(dataStoreModule, uid);
  }, 5000);

  logger.info('Telemetriya arxivlagichi ishga tushdi');
}

/** RTDB history buferdan Firestore'ga o'tgan ma'lumotlarni yozish */
async function backfillFromRtdb(dataStoreModule, uid) {
  try {
    const st = dataStoreModule.getState();
    if (!st || !st.devices || !st.devices.length) return;

    // Firebase RTDB import
    const { getDatabase, ref, get } = await import('firebase/database');
    const rtdb = getDatabase();

    for (const dev of st.devices) {
      const devId = dev.id;
      try {
        // RTDB'dagi history bo'limi (agar mavjud bo'lsa)
        const histRef = ref(rtdb, `nodes/${devId}/history`);
        const snap = await get(histRef);
        if (!snap.exists()) continue;

        const histData = snap.val();
        if (!histData || typeof histData !== 'object') continue;

        // Kunlar bo'yicha guruhlash
        const byDay = new Map();
        Object.values(histData).forEach((entry) => {
          if (!entry || typeof entry.ts !== 'number') return;
          const dk = dayKey(entry.ts);
          if (!byDay.has(dk)) byDay.set(dk, []);
          const sample = { ts: entry.ts };
          for (const k of ['do', 't', 'ph', 'aer', 'rssi', 'battery']) {
            if (typeof entry[k] === 'number' && Number.isFinite(entry[k])) sample[k] = entry[k];
          }
          byDay.get(dk).push(sample);
        });

        // Har kunlik hujjatga yozish
        for (const [dk, samples] of byDay) {
          if (!samples.length) continue;
          try {
            // Avval mavjud hujjatni tekshirish
            const docRef = doc(db, 'telemetryArchive', `${devId}_${dk}`);
            const existing = await getDoc(docRef);
            const existingSamples = existing.exists() ? (existing.data().samples || []) : [];
            const existingTs = new Set(existingSamples.map((s) => s.ts));

            // Faqat yangi sample'larni qo'shish
            const newSamples = samples.filter((s) => !existingTs.has(s.ts));
            if (!newSamples.length) continue;

            await setDoc(docRef, {
              deviceId: devId, ownerUid: uid, dayKey: dk,
              updatedAt: serverTimestamp(),
              samples: arrayUnion(...newSamples),
            }, { merge: true });

            logger.info(`Backfill: ${devId} ${dk} — ${newSamples.length} yangi sample`);
          } catch (e) { logger.warn(`Backfill yozish: ${devId}_${dk}:`, e && e.message); }
        }
      } catch (e) { logger.warn(`Backfill ${devId}:`, e && e.message); }
    }
    logger.info('RTDB backfill tugadi');
  } catch (e) { logger.warn('Backfill xato:', e && e.message); }
}

// ------------------------------------------------------------
//  O'QUVCHI — davr bo'yicha sample'lar
// ------------------------------------------------------------
export async function fetchArchive(uid, deviceIds, fromTs, toTs, isAdmin = false) {
  if (!uid || !deviceIds.length) return [];
  const fromKey = dayKey(fromTs), toKey = dayKey(toTs);

  // Admin bo'lsa — ownerUid filtrlamasdan, deviceId bo'yicha o'qiydi
  // Fermer bo'lsa — faqat o'z ma'lumotlarini ko'radi
  const out = [];
  const idSet = new Set(deviceIds);

  if (isAdmin) {
    // Admin: deviceId bo'yicha har kunlik hujjatlarni to'g'ridan o'qish
    for (const devId of deviceIds) {
      // fromKey dan toKey gacha barcha kunlarni generatsiya qilish
      const start = new Date(fromTs);
      const end = new Date(toTs);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dk = dayKey(d.getTime());
        try {
          const snap = await getDoc(doc(db, 'telemetryArchive', `${devId}_${dk}`));
          if (snap.exists()) {
            const data = snap.data();
            (data.samples || []).forEach((sm) => {
              if (sm && typeof sm.ts === 'number' && sm.ts >= fromTs && sm.ts <= toTs) out.push(sm);
            });
          }
        } catch { /* skip */ }
      }
    }
  } else {
    // Fermer: ownerUid filtr bilan
    const q = query(collection(db, 'telemetryArchive'),
      where('ownerUid', '==', uid),
      where('dayKey', '>=', fromKey),
      where('dayKey', '<=', toKey));
    const snap = await getDocs(q);
    snap.forEach((d) => {
      const data = d.data();
      if (!idSet.has(data.deviceId)) return;
      (data.samples || []).forEach((sm) => {
        if (sm && typeof sm.ts === 'number' && sm.ts >= fromTs && sm.ts <= toTs) out.push(sm);
      });
    });
  }

  out.sort((a, b) => a.ts - b.ts);
  return out;
}

// ------------------------------------------------------------
//  AGREGATSIYA — jadval qatorlarini davr kesimida yig'ish
// ------------------------------------------------------------
export function aggregateSamples(samples, bucketMs) {
  const buckets = new Map();
  for (const sm of samples) {
    const key = Math.floor(sm.ts / bucketMs) * bucketMs;
    let b = buckets.get(key);
    if (!b) { b = { ts: key, n: 0, do: 0, nd: 0, t: 0, nt: 0, ph: 0, np: 0 }; buckets.set(key, b); }
    b.n += 1;
    if (typeof sm.do === 'number') { b.do += sm.do; b.nd += 1; }
    if (typeof sm.t === 'number') { b.t += sm.t; b.nt += 1; }
    if (typeof sm.ph === 'number') { b.ph += sm.ph; b.np += 1; }
  }
  return [...buckets.values()]
    .map((b) => ({
      ts: b.ts,
      do: b.nd ? b.do / b.nd : null,
      t: b.nt ? b.t / b.nt : null,
      ph: b.np ? b.ph / b.np : null,
    }))
    .sort((a, b) => a.ts - b.ts);
}

// ------------------------------------------------------------
//  ELEKTR — aer=1 bo'lgan vaqtni taxminan tiklash (millisekund)
// ------------------------------------------------------------
export function aeratorRuntimeMs(samples) {
  let ms = 0;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    if (prev.aer === 1) ms += Math.min(samples[i].ts - prev.ts, MAX_GAP_MS);
  }
  // Oxirgi sample hozirga yaqin va aer=1 bo'lsa — davom etayotgan ish
  const last = samples[samples.length - 1];
  if (last && last.aer === 1) ms += Math.min(Date.now() - last.ts, MAX_GAP_MS);
  return ms;
}

// ------------------------------------------------------------
//  KO'L META (energiya sozlamalari: kW, tarif) — lakeMeta/{lakeId}
// ------------------------------------------------------------
export async function loadLakeMeta(lakeId) {
  try {
    const snap = await getDoc(doc(db, 'lakeMeta', lakeId));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}
export async function saveLakeMeta(lakeId, uid, patch) {
  await setDoc(doc(db, 'lakeMeta', lakeId), { ownerUid: uid, ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

export default { startArchiver, fetchArchive, aggregateSamples, aeratorRuntimeMs, loadLakeMeta, saveLakeMeta, dayKey };
