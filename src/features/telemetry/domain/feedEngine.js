// ============================================================
//  features/telemetry/domain/feedEngine.js — YEM HISOBI v2 (D+)
//  Manba: professional yem jadvali (HUALONG SILIAO plakati) —
//  kunlik yem % SUV HARORATI × BALIQ VAZNI SINFI bo'yicha, ovqat
//  vaqtlari haroratga qarab. Qo'shimcha plakat qoidalari:
//   1) Jazirama issiqda kunlik norma 4-5 mahalga bo'linadi
//   2) Bulutli/yomg'irli kunda yem 50% kamaytiriladi
//   3) pH normasi 7.5–8.5, kislorod 6 mg/L dan tushmasin
//  Sof funksiyalar — unit-testlar bilan qoplangan.
// ============================================================

/** Vazn sinflari (gramm): [20-100) [100-300) [300-600) [600-1200) [1200+) */
const WEIGHT_BOUNDS = [100, 300, 600, 1200];

/** Harorat qatorlari: [tempDan, [sinf1..sinf5 stavkalari %], [ovqat vaqtlari]] */
const FEED_MATRIX = [
  [33, [3.0, 2.0, 2.0, 2.0, 1.75], ['07:00', '09:00', '11:00', '14:30', '17:30']],  // 5 mahal (qoida 1)
  [30, [4.0, 3.0, 2.5, 2.5, 2.0],  ['07:00', '09:30', '11:00', '14:30', '17:30']],  // 5 mahal
  [27, [5.0, 3.5, 4.0, 4.0, 3.0],  ['08:00', '10:30', '14:30', '16:30']],
  [24, [4.0, 4.0, 3.5, 3.0, 2.5],  ['08:00', '11:00', '17:00']],
  [22, [3.0, 3.5, 3.0, 2.0, 2.0],  ['09:00', '11:30', '16:00']],
  [18, [2.0, 2.0, 2.0, 1.5, 1.5],  ['10:00', '15:00']],
  [15, [1.0, 1.0, 1.5, 1.3, 1.0],  ['10:00', '14:00']],
  [12, [0.5, 0.75, 0.75, 0.75, 0.75], ['12:00']],
];

/** Vazn (g) -> sinf indeksi 0..4. */
export function weightClass(avgWeightG) {
  const w = Number(avgWeightG) || 0;
  for (let i = 0; i < WEIGHT_BOUNDS.length; i++) if (w < WEIGHT_BOUNDS[i]) return i;
  return 4;
}

/** Harorat qatorini tanlash (eng yaqin pastki qator; <12°C -> minimal). */
function matrixRow(tempC) {
  const t = Number.isFinite(tempC) ? tempC : 24;   // noma'lum -> mo'tadil
  for (const row of FEED_MATRIX) if (t >= row[0]) return row;
  return [10, [0.5, 0.5, 0.5, 0.5, 0.5], ['12:00']];   // juda sovuq: minimal, 1 mahal
}

/** Jadvaldan stavka: harorat + o'rtacha vazn -> kunlik % . */
export function feedRatePct(tempC, avgWeightG = 400) {
  return matrixRow(tempC)[1][weightClass(avgWeightG)];
}

/** Biomassa (kg): fish = [{count, avgWeight(g)}]. */
export function biomassKg(fish = []) {
  return fish.reduce((sum, f) => sum + ((Number(f.count) || 0) * (Number(f.avgWeight) || 0)) / 1000, 0);
}

/** Ob-havo yomonmi (plakat 2-qoidasi: 50% kamaytirish)? WMO kodlari. */
export function badWeather(weather) {
  if (!weather || weather.code == null) return false;
  const c = Number(weather.code);
  return c === 3 || c >= 45;   // to'liq bulutli, tuman, yomg'ir, qor, momaqaldiroq
}

/**
 * Kunlik yem rejasi (jadval asosida, har baliq turi o'z sinfida).
 * @returns null | { biomass, dailyKg, ratePct, perFish, meals, dailyCost, notes[] }
 */
export function computeFeedPlan({ fish = [], feed = {}, tempC = null, weather = null } = {}) {
  const bm = biomassKg(fish);
  if (bm <= 0) return null;

  const notes = [];
  const row = matrixRow(tempC);
  let dailyKg = 0;
  const perFish = fish.map((f) => {
    const kgBm = ((Number(f.count) || 0) * (Number(f.avgWeight) || 0)) / 1000;
    const rate = feedRatePct(tempC, f.avgWeight);
    const kg = (kgBm * rate) / 100;
    dailyKg += kg;
    return { type: f.type || '', rate, kg };
  });

  if (Number.isFinite(tempC) && tempC >= 30) {
    notes.push({ id: 'heat', text: `Issiq (${tempC}°C): norma ${row[2].length} mahalga bo'lindi, stavka jadval bo'yicha pasaytirilgan` });
  }
  if (badWeather(weather)) {
    dailyKg *= 0.5;
    perFish.forEach((p) => { p.kg *= 0.5; });
    notes.push({ id: 'weather', text: `Ob-havo yomon (${weather.label || 'bulutli'}): yem 50% kamaytirildi` });
  }

  const price = Number(feed.price) > 0 ? Number(feed.price) : null;
  const share = 1 / row[2].length;
  return {
    biomass: bm,
    dailyKg,
    ratePct: +(dailyKg / bm * 100).toFixed(2),   // samarali o'rtacha stavka (ko'rsatish uchun)
    perFish,
    meals: row[2].map((time) => ({ time, share, kg: dailyKg * share })),
    dailyCost: price != null ? dailyKg * price : null,
    notes,
    source: 'HUALONG SILIAO yem jadvali',
  };
}

/** Davr uchun jami (kunlik reja × kunlar) — taxminiy. */
export function periodFeedTotals(plan, days) {
  if (!plan || !days) return null;
  return { kg: plan.dailyKg * days, cost: plan.dailyCost != null ? plan.dailyCost * days : null };
}

export default { feedRatePct, weightClass, biomassKg, badWeather, computeFeedPlan, periodFeedTotals };
