// ============================================================
//  features/commands/constants/commandConstants.js
//  Buyruq ta'riflari: har type -> label, ikon, guruh, payload.
//
//  GW-BRIDGE: toGatewayCommand() qo'shildi — ilova buyrug'ini
//  gateway firmware kutadigan RTDB formatiga tarjima qiladi:
//    /commands/<key> = { node:"AQxxxxxxxx", aer|mode|mindo|farq|kritik|time|status, ts }
//  Gateway 2 soniyada bir o'qiydi, LoRa orqali node'ga yuboradi
//  va yozuvni o'chiradi. 10 daqiqadan eski buyruq bajarilmaydi (ts).
//  Firmware O'ZGARMAGAN — mapping firmware'dagi buyruqlarga aynan mos.
// ============================================================

import { COMMAND_TYPES } from '../../../core/collections.js';

const T = COMMAND_TYPES;

/** Har buyruq turi uchun metama'lumot (UI + payload). */
export const COMMAND_DEFS = Object.freeze({
  [T.AERATOR_ON]:     { labelKey: 'cmd.aeratorOn',    icon: 'power',       group: 'aerator',    payload: { aerator: 1 } },
  [T.AERATOR_OFF]:    { labelKey: 'cmd.aeratorOff',   icon: 'power',       group: 'aerator',    payload: { aerator: 0 } },
  [T.AUTO_ON]:        { labelKey: 'cmd.autoOn',       icon: 'activity',    group: 'auto',       payload: { auto: 1 } },
  [T.AUTO_OFF]:       { labelKey: 'cmd.autoOff',      icon: 'activity',    group: 'auto',       payload: { auto: 0 } },
  [T.FEED_START]:     { labelKey: 'cmd.feedStart',    icon: 'droplet',     group: 'feed',       payload: { feed: 1 } },
  [T.FEED_STOP]:      { labelKey: 'cmd.feedStop',     icon: 'droplet',     group: 'feed',       payload: { feed: 0 } },
  [T.RESTART]:        { labelKey: 'cmd.restart',      icon: 'power',       group: 'system',     payload: {} },
  [T.SYNC_TIME]:      { labelKey: 'cmd.syncTime',     icon: 'settings',    group: 'system',     payload: {} },
  [T.REQUEST_STATUS]: { labelKey: 'cmd.reqStatus',    icon: 'info',        group: 'system',     payload: {} },
  [T.REQUEST_CONFIG]: { labelKey: 'cmd.reqConfig',    icon: 'settings',    group: 'system',     payload: {} },
  // GW-BRIDGE: firmware'dagi haqiqiy buyruqlar
  [T.MODE_DO]:        { labelKey: 'cmd.modeDo',       icon: 'activity',    group: 'mode',       payload: { mode: 0 } },
  [T.MODE_TIME]:      { labelKey: 'cmd.modeTime',     icon: 'settings',    group: 'mode',       payload: { mode: 1 } },
  [T.SET_MINDO]:      { labelKey: 'cmd.setMindo',     icon: 'droplet',     group: 'thresholds', payload: {} },
  [T.SET_FARQ]:       { labelKey: 'cmd.setFarq',      icon: 'droplet',     group: 'thresholds', payload: {} },
  [T.SET_KRITIK]:     { labelKey: 'cmd.setKritik',    icon: 'droplet',     group: 'thresholds', payload: {} },
});

/** Buyruq uchun kanonik payload (sync_time'ga vaqt qo'shiladi). */
export function buildPayload(type, now = Date.now()) {
  const def = COMMAND_DEFS[type];
  if (!def) return null;
  const base = { ...def.payload };
  if (type === COMMAND_TYPES.SYNC_TIME) base.ts = now;
  return base;
}

/** Chegara qiymatlari uchun ruxsat etilgan diapazon (firmware validatsiyasi bilan BIR XIL). */
export const THRESHOLD_LIMITS = Object.freeze({
  [T.SET_MINDO]:  { min: 1, max: 20, gwKey: 'mindo'  },   // gateway: 1..20
  [T.SET_FARQ]:   { min: 1, max: 10, gwKey: 'farq'   },   // gateway: 1..10
  [T.SET_KRITIK]: { min: 1, max: 20, gwKey: 'kritik' },   // gateway: 1..20
});

/**
 * Ilova buyrug'ini gateway RTDB formatiga tarjima qilish.
 * @param {string} type      COMMAND_TYPES qiymati
 * @param {object} payload   { value } (chegara/timeout uchun)
 * @param {string} deviceId  AQxxxxxxxx
 * @param {number} now       ms
 * @returns {object|null}    RTDB obyekt yoki null (firmware qo'llamaydi)
 */
export function toGatewayCommand(type, payload, deviceId, now = Date.now()) {
  const p = payload || {};
  const base = { node: deviceId, ts: now };

  switch (type) {
    case T.AERATOR_ON: {
      const out = { ...base, aer: 1 };
      // Fix 12 (firmware): ixtiyoriy timeout daqiqada (0..1440), 0 = cheksiz
      const tm = Number(p.timeout);
      if (Number.isInteger(tm) && tm > 0 && tm <= 1440) out.timeout = tm;
      return out;
    }
    case T.AERATOR_OFF:
    case T.AUTO_ON:
      // Firmware'da majburiy "o'chirish" YO'Q: aer=0 -> AVTO rejimga qaytadi,
      // node kislorod yetarli bo'lsa aeratorni O'ZI o'chiradi.
      return { ...base, aer: 0 };

    case T.MODE_DO:   return { ...base, mode: 0 };   // kislorod (avto) rejimi
    case T.MODE_TIME: return { ...base, mode: 1 };   // vaqt jadvali rejimi

    case T.SET_MINDO:
    case T.SET_FARQ:
    case T.SET_KRITIK: {
      const lim = THRESHOLD_LIMITS[type];
      const v = Number(p.value);
      if (!Number.isInteger(v) || v < lim.min || v > lim.max) return null;
      return { ...base, [lim.gwKey]: v };
    }

    case T.SYNC_TIME:      return { ...base, time: Math.floor(now / 1000) };  // Unix soniya
    case T.REQUEST_STATUS: return { ...base, status: 1 };

    // Firmware'da mavjud emas: yem motori, restart, config so'rovi, auto_off
    default:
      return null;
  }
}

export const COMMAND_TTL_MS = 15 * 60 * 1000;   // pending 15 daq -> expired (CF/admin)

export default { COMMAND_DEFS, buildPayload, toGatewayCommand, THRESHOLD_LIMITS, COMMAND_TTL_MS };
