// ============================================================
//  features/telemetry/domain/sensorState.js — SENSOR HOLATI (sof)
//  Muammo: sensor ULANMAGAN bo'lsa 0 keladi — bu NOSOZLIK EMAS.
//  Bu modul qiymatni "sog'lom/nosoz" bahosidan OLDIN mavjudlik
//  bosqichidan o'tkazadi: present / absent / disabled / calibration.
//
//  ARXITEKTURA (kelajakka tayyor): firmware keyinchalik
//  `<key>_state` maydonini yuborsa (0=off,1=ok,2=calib), shu yerda
//  avtomatik tushuniladi — statusEngine/firmware O'ZGARTIRILMAGAN.
// ============================================================

export const SENSOR_STATE = Object.freeze({
  PRESENT: 'present',        // qiymat ishonchli
  ABSENT: 'absent',          // sensor ulanmagan / mavjud emas
  DISABLED: 'disabled',      // sensor o'chirilgan (kelajak: <key>_state=0)
  CALIBRATION: 'calibration',// kalibrovka talab qilinadi (kelajak: =2)
});

/* 0 qiymati "mavjud emas" deb tushuniladigan kanallar
   (DO/pH/TDS/NH3 real sharoitda 0 bo'lmaydi; temp 0°C mumkin). */
const ZERO_MEANS_ABSENT = new Set(['do', 'ph', 'tds', 'nh3']);

/**
 * Bitta qurilma telemetriyasida kanal holati.
 * @param {object|null} tel  telemetriya
 * @param {string} key       'do'|'t'|'ph'|'tds'|'nh3'|'battery'...
 * @returns {string} SENSOR_STATE qiymati
 */
export function sensorState(tel, key) {
  if (!tel) return SENSOR_STATE.ABSENT;
  const st = tel[`${key}_state`];
  if (st === 0) return SENSOR_STATE.DISABLED;
  if (st === 2) return SENSOR_STATE.CALIBRATION;
  const v = tel[key];
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return SENSOR_STATE.ABSENT;
  if (v === 0 && ZERO_MEANS_ABSENT.has(key)) return SENSOR_STATE.ABSENT;
  return SENSOR_STATE.PRESENT;
}

/** Ko'l darajasida: kamida bitta qurilmada present bo'lsa — present. */
export function lakeSensorState(tels, key) {
  let seen = SENSOR_STATE.ABSENT;
  for (const tel of tels) {
    const s = sensorState(tel, key);
    if (s === SENSOR_STATE.PRESENT) return SENSOR_STATE.PRESENT;
    if (s === SENSOR_STATE.CALIBRATION) seen = SENSOR_STATE.CALIBRATION;
    else if (s === SENSOR_STATE.DISABLED && seen === SENSOR_STATE.ABSENT) seen = SENSOR_STATE.DISABLED;
  }
  return seen;
}

export default { SENSOR_STATE, sensorState, lakeSensorState };
