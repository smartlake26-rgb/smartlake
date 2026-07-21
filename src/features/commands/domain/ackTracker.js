// ============================================================
//  features/commands/domain/ackTracker.js — QURILMA TASDIG'I kuzatuvchisi
//
//  MAQSAD: "Buyruq yuborildi" (bazaga yozildi) bilan "Qurilmada
//  HAQIQATAN saqlandi" ni farqlash. Node har buyruqqa CMDACK
//  qaytaradi (gateway -> nodes/<id>/latest: last_cmd, last_cmd_ok,
//  last_cmd_ts) va v16.2 dan boshlab darhol yangi telemetriya
//  yuboradi — shu ikkisidan haqiqiy tasdiq yasaymiz.
//
//  HOLATLAR (onUpdate(state, pending) orqali):
//    'waiting'  — yuborildi, qurilma javobi kutilmoqda
//    'acked'    — qurilma qabul qildi (ACK keldi), qiymat aks etishi
//                 kutilmoqda (faqat chegara buyruqlarida oraliq holat)
//    'saved'    — YASHIL: qurilmada haqiqatan saqlandi
//                 (chegaralar: yuborilgan qiymat telemetriyada aks etdi;
//                  boshqa buyruqlar: mos ACK keldi)
//    'rejected' — qurilma buyruqni rad etdi (last_cmd_ok = 0)
//    'timeout'  — 60s ichida javob kelmadi (aloqa muammosi)
// ============================================================

import { COMMAND_TYPES as T } from '../../../core/collections.js';

/** Ilova buyruq turi -> firmware buyruq kodi (node #define CMD_* bilan aynan mos). */
export const GW_CMD_CODES = Object.freeze({
  [T.AERATOR_ON]: 1,     // CMD_AER_ON
  [T.AERATOR_OFF]: 2,    // CMD_AER_AUTO
  [T.AUTO_ON]: 2,        // legacy — avto rejimga qaytarish
  [T.SET_MINDO]: 3,      // CMD_MINDO
  [T.SET_FARQ]: 4,       // CMD_FARQ
  [T.SET_KRITIK]: 5,     // CMD_KRITIK
  [T.MODE_DO]: 6,        // CMD_MODE (val=0)
  [T.MODE_TIME]: 6,      // CMD_MODE (val=1)
  [T.REQUEST_STATUS]: 7, // CMD_STATUS
  [T.SYNC_TIME]: 8,      // CMD_TIME
});

const SKEW_MS    = 15 * 1000;   // ilova va server soati orasidagi ruxsat etilgan farq
const TIMEOUT_MS = 60 * 1000;   // shu vaqtgacha javob bo'lmasa — 'timeout'

/**
 * @param {(state:string, pending:object)=>void} onUpdate — holat o'zgarishi callback'i
 */
export function createAckTracker(onUpdate) {
  let pending = null;
  let timer = null;

  function clear() {
    if (timer) { clearTimeout(timer); timer = null; }
    pending = null;
  }

  return {
    /**
     * Yangi yuborilgan buyruqni kuzatishni boshlash.
     * @param {string} type  COMMAND_TYPES qiymati
     * @param {object} opts  { value, telKey } — chegara buyruqlari uchun:
     *                       telemetriyada qaysi maydon qaysi qiymatga teng
     *                       bo'lsa "saqlandi" hisoblanadi (eng kuchli isbot).
     */
    expect(type, opts = {}) {
      clear();
      pending = {
        type,
        code: GW_CMD_CODES[type] ?? null,
        value: typeof opts.value === 'number' ? opts.value : null,
        telKey: opts.telKey || null,
        sentAt: Date.now(),
        acked: false,
      };
      timer = setTimeout(() => {
        if (!pending) return;
        const p = pending; clear();
        onUpdate('timeout', p);
      }, TIMEOUT_MS);
      onUpdate('waiting', pending);
    },

    /** Har yangi telemetriya kelganda chaqiriladi. */
    feed(tel) {
      if (!pending || !tel) return;
      const p = pending;

      // ACK yangimi va aynan bizning buyruqqami?
      const ackFresh = typeof tel.last_cmd_ts === 'number' && tel.last_cmd_ts >= p.sentAt - SKEW_MS;
      const ackMatch = ackFresh && typeof tel.last_cmd === 'number' && tel.last_cmd === p.code;

      if (ackMatch && tel.last_cmd_ok === 0) {
        clear(); onUpdate('rejected', p); return;
      }

      const telFresh = typeof tel.ts === 'number' && tel.ts >= p.sentAt - SKEW_MS;

      if (p.telKey) {
        // Chegara buyrug'i: YASHIL faqat qiymat qurilmadan qaytib kelganda.
        const valMatch = telFresh
          && typeof tel[p.telKey] === 'number'
          && Math.round(tel[p.telKey]) === p.value;
        if (valMatch) { clear(); onUpdate('saved', p); return; }
        if (ackMatch && !p.acked) { p.acked = true; onUpdate('acked', p); }
      } else if (ackMatch) {
        // Aerator/rejim/tizim: mos ACK — saqlandi.
        clear(); onUpdate('saved', p);
      }
    },

    /** Sahifa yopilganda chaqirish. */
    cancel: clear,
  };
}

export default createAckTracker;
