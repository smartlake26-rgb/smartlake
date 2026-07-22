// ============================================================
//  features/telemetry/domain/feedEngine.js — YEM HISOBI (C-bosqich)
//  Sof funksiyalar (Firebase'siz) — testlanadi, AI tavsiya (D) ham
//  shu dvigateldan foydalanadi.
//
//  Model (baliqchilikda qabul qilingan soddalashtirilgan norma):
//   • Biomassa = Σ (soni × joriy o'rtacha vazn)
//   • Kunlik yem % — suv haroratiga bog'liq:
//       <12°C: 0.5%  |  12–15: 1%  |  15–20: 2%  |  20–26: 3%
//       26–30: 2.5%  |  >30: 1.5%  (issiqlik stressida kamaytiriladi)
//   • Ovqatlantirish 3 mahal: 07:00 (35%), 13:00 (40%), 18:00 (25%)
// ============================================================

/** Harorat -> kunlik yem foizi (biomassadan). */
export function feedRatePct(tempC) {
  if (tempC == null || !Number.isFinite(tempC)) return 2.5;   // noma'lum -> o'rtacha
  if (tempC < 12) return 0.5;
  if (tempC < 15) return 1.0;
  if (tempC < 20) return 2.0;
  if (tempC < 26) return 3.0;
  if (tempC <= 30) return 2.5;
  return 1.5;
}

/** Biomassa (kg): fish = [{count, avgWeight(g)}]. */
export function biomassKg(fish = []) {
  return fish.reduce((sum, f) => {
    const c = Number(f.count) || 0;
    const w = Number(f.avgWeight) || 0;   // gramm
    return sum + (c * w) / 1000;
  }, 0);
}

/**
 * Kunlik yem rejasi.
 * @returns {null | {biomass, ratePct, dailyKg, meals:[{time,kg,share}], dailyCost}}
 */
export function computeFeedPlan({ fish, feed, tempC }) {
  const bm = biomassKg(fish);
  if (bm <= 0) return null;
  const rate = feedRatePct(tempC);
  const dailyKg = (bm * rate) / 100;
  const price = feed && Number(feed.price) > 0 ? Number(feed.price) : null;
  const MEALS = [['07:00', 0.35], ['13:00', 0.40], ['18:00', 0.25]];
  return {
    biomass: bm,
    ratePct: rate,
    dailyKg,
    meals: MEALS.map(([time, share]) => ({ time, share, kg: dailyKg * share })),
    dailyCost: price != null ? dailyKg * price : null,
  };
}

/** Davr uchun jami (kunlik reja × kunlar) — taxminiy. */
export function periodFeedTotals(plan, days) {
  if (!plan || !days) return null;
  return {
    kg: plan.dailyKg * days,
    cost: plan.dailyCost != null ? plan.dailyCost * days : null,
  };
}

export default { feedRatePct, biomassKg, computeFeedPlan, periodFeedTotals };
