// ============================================================
//  features/telemetry/domain/sensorState.js — SENSOR HOLATI (sof)
//  Muammo: sensor ULANMAGAN bo'lsa 0 keladi — bu NOSOZLIK EMAS.
//  Bu modul qiymatni "sog'lom/nosoz" bahosidan OLDIN mavjudlik
//  bosqichidan o'tkazadi.
//
//  Holatlar:
//    PRESENT     — qiymat ishonchli, AI ishlatishi mumkin
//    ABSENT      — sensor o'rnatilmagan / biriktirilmagan
//    DISCONNECTED— sensor qurilmada bor, lekin uzoq aloqa yo'q
//    DISABLED    — sensor dasturiy o'chirilgan (tel[key_state]=0)
//    FAULTY      — sensor nosoz deb taxmin qilinadi (haddan tashqari
//                  tartibsiz qiymatlar yoki musbat _state=3 belgisi)
//    CALIBRATION — kalibrovka talab qilinadi (tel[key_state]=2)
//
//  ARXITEKTURA: firmware keyinchalik `<key>_state` yuborsa
//  shu yerda avtomatik tushuniladi — statusEngine/firmware
//  O'ZGARTIRILMAGAN.
// ============================================================

export const SENSOR_STATE = Object.freeze({
  PRESENT:      'present',       // qiymat ishonchli
  ABSENT:       'absent',        // sensor o'rnatilmagan / mavjud emas
  DISCONNECTED: 'disconnected',  // aloqa uzilgan (qurilma bor, signal yo'q)
  DISABLED:     'disabled',      // sensor dasturiy o'chirilgan
  FAULTY:       'faulty',        // sensor nosoz
  CALIBRATION:  'calibration',   // kalibrovka talab qilinadi
});

/* 0 qiymati "mavjud emas" deb tushuniladigan kanallar
   (DO/pH/TDS/NH3 real sharoitda 0 bo'lmaydi; temp 0°C mumkin). */
const ZERO_MEANS_ABSENT = new Set(['do', 'ph', 'tds', 'nh3']);

/* Fizikaviy chegaralar tashqarisidagi qiymat = nosoz sensor.
   Firmware/sensor protokoliga tegilmagan — faqat UI filtrlaym. */
const PLAUSIBLE = {
  do:  [0.01, 20],    // mg/L  (0.01 minimum — haqiqiy 0 bo'lmaydi)
  t:   [-5, 50],      // °C
  ph:  [4, 11],
  tds: [1, 5000],     // ppm
  nh3: [0.001, 30],   // mg/L
};

/**
 * Bitta qurilma telemetriyasida kanal holati.
 * @param {object|null} tel  telemetriya
 * @param {string} key       'do'|'t'|'ph'|'tds'|'nh3'|'battery'...
 * @param {{lastSeen?:number, maxGapMs?:number}} [opts]
 * @returns {string} SENSOR_STATE qiymati
 */
export function sensorState(tel, key, { maxGapMs = 30 * 60e3 } = {}) {
  if (!tel) return SENSOR_STATE.ABSENT;

  // 1. Aloqa: qurilmaning o'zi uzoq vaqt ma'lumot yubormaganmi?
  if (tel.ts && Date.now() - tel.ts > maxGapMs) {
    return SENSOR_STATE.DISCONNECTED;
  }

  // 2. Firmware'dagi _state maydoni (kelajakka tayyor)
  const st = tel[`${key}_state`];
  if (st === 0) return SENSOR_STATE.DISABLED;
  if (st === 2) return SENSOR_STATE.CALIBRATION;
  if (st === 3) return SENSOR_STATE.FAULTY;

  const v = tel[key];

  // 3. Qiymat yo'q yoki nol (sensor o'rnatilmagan)
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return SENSOR_STATE.ABSENT;
  if (v === 0 && ZERO_MEANS_ABSENT.has(key)) return SENSOR_STATE.ABSENT;

  // 4. Fizikaviy chegaralar (nosoz sensor filtri — firmware'ga tegilmagan)
  const range = PLAUSIBLE[key];
  if (range && (v < range[0] || v > range[1])) return SENSOR_STATE.FAULTY;

  return SENSOR_STATE.PRESENT;
}

/** Ko'l darajasida: kamida bitta qurilmada present bo'lsa — present.
 *  Eng og'ir holat yutuq qozonadi: present > calib > faulty > disabled > disconnected > absent */
export function lakeSensorState(tels, key, opts) {
  const ORDER = [
    SENSOR_STATE.PRESENT, SENSOR_STATE.CALIBRATION, SENSOR_STATE.FAULTY,
    SENSOR_STATE.DISABLED, SENSOR_STATE.DISCONNECTED, SENSOR_STATE.ABSENT,
  ];
  let best = SENSOR_STATE.ABSENT;
  for (const tel of tels) {
    const s = sensorState(tel, key, opts);
    if (s === SENSOR_STATE.PRESENT) return SENSOR_STATE.PRESENT;
    if (ORDER.indexOf(s) < ORDER.indexOf(best)) best = s;
  }
  return best;
}

/** Foydalanuvchiga ko'rsatiladigan holat matni (i18n-tayyor).
 *  Chaqiruvchi tomon t() funktsiyasidan foydalanadi.
 *  Bu funksiya i18n kalitini qaytaradi. */
export function sensorStateI18nKey(state) {
  const MAP = {
    [SENSOR_STATE.ABSENT]:       'sensor.absent',
    [SENSOR_STATE.DISCONNECTED]: 'sensor.disconnected',
    [SENSOR_STATE.DISABLED]:     'sensor.disabled',
    [SENSOR_STATE.FAULTY]:       'sensor.faulty',
    [SENSOR_STATE.CALIBRATION]:  'sensor.calibration',
  };
  return MAP[state] || null;   // PRESENT -> null (qiymat ko'rsatiladi)
}

export default { SENSOR_STATE, sensorState, lakeSensorState, sensorStateI18nKey };
