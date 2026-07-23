// ============================================================
//  features/telemetry/domain/growth.js — VAZN O'SISHI BAHOSI (sof)
//  Yem koeffitsiyenti (FCR) asosida taxminiy joriy vazn:
//    kunlik o'sish (g) = kunlik yem (g) / FCR
//    kunlik yem = vazn × stavka% (feedEngine jadvalidan)
//  FAQAT feedBasedGrowth=true bo'lgan turlar uchun qo'llanadi —
//  chaqiruvchi buni KATALOG PARAMETRIDAN tekshiradi (nom bo'yicha
//  emas). feedEngine O'ZGARTIRILMAGAN — faqat o'qib ishlatiladi.
// ============================================================

import { feedRatePct } from './feedEngine.js';

const DAY = 24 * 3600e3;
const MAX_DAYS = 730;   // himoya chegarasi (2 yil)

/**
 * Taxminiy joriy o'rtacha vazn (gramm).
 * @param {object} p
 * @param {number} p.startWeightG   — boshlang'ich vazn (g)
 * @param {number} p.stockedAtTs    — qachon tashlangan (ms)
 * @param {number} p.fcr            — katalogdan (kg yem / kg o'sish)
 * @param {number} [p.tempC=24]     — o'rtacha suv harorati
 * @param {number} [p.nowTs]
 * @returns {number|null} taxminiy vazn (g) yoki null (ma'lumot yetarli emas)
 */
export function estimateAvgWeightG({ startWeightG, stockedAtTs, fcr, tempC = 24, nowTs = Date.now() } = {}) {
  const w0 = Number(startWeightG);
  const f = Number(fcr);
  if (!Number.isFinite(w0) || w0 <= 0 || !Number.isFinite(f) || f <= 0 || !stockedAtTs) return null;
  const days = Math.min(MAX_DAYS, Math.max(0, Math.floor((nowTs - stockedAtTs) / DAY)));
  let w = w0;
  for (let i = 0; i < days; i++) {
    const dailyFeedG = (w * feedRatePct(tempC, w)) / 100;
    w += dailyFeedG / f;
  }
  return Math.round(w);
}

export default { estimateAvgWeightG };
