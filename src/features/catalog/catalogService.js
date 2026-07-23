// ============================================================
//  features/catalog/catalogService.js — BALIQ/YEM KATALOGI (CAT-V1)
//  Fermer nom YOZMAYDI — SuperAdmin katalogidan TANLAYDI.
//
//  ARXITEKTURA:
//  - O'QISH-FAQAT: `fishCatalog` va `feedCatalog` kolleksiyalari.
//    Baliq:  { nameUz, nameRu, feedBasedGrowth: true|false,
//              fcr?: number (yem koeffitsiyenti, kg yem / kg o'sish),
//              active }
//    Yem:    { nameUz, nameRu, protein, fcr, active }
//  - Kod baliq NOMI bo'yicha emas, KATALOG PARAMETRI bo'yicha
//    ishlaydi (feedBasedGrowth/fcr) — yangi tur qo'shish oson.
//  - Kolleksiya/ruxsat hali bo'lmasa XAVFSIZ zaxira katalogga
//    o'tadi (quyidagi DEFAULTS) — Firestore strukturasi/rules'ga
//    TEGILMAGAN, yozish yo'li YO'Q.
// ============================================================

import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../core/firebase.js';

/* Zaxira katalog — admin tomoni ishga tushguncha ishlaydi. */
export const DEFAULT_FISH = [
  { id: 'karp', nameUz: 'Karp', nameRu: 'Карп', feedBasedGrowth: true, fcr: 1.8 },
  { id: 'oq_amur', nameUz: 'Oq amur', nameRu: 'Белый амур', feedBasedGrowth: true, fcr: 2.0 },
  { id: 'dongpeshona', nameUz: "Do'ngpeshona", nameRu: 'Толстолобик', feedBasedGrowth: false },
  { id: 'laqqa', nameUz: 'Laqqa (som)', nameRu: 'Сом', feedBasedGrowth: true, fcr: 1.5 },
  { id: 'forel', nameUz: 'Forel', nameRu: 'Форель', feedBasedGrowth: true, fcr: 1.2 },
];
export const DEFAULT_FEED = [
  { id: 'start', nameUz: 'Start (mayda granula)', nameRu: 'Старт (мелкая гранула)', protein: 38, fcr: 1.2 },
  { id: 'grower', nameUz: "O'stiruvchi (grower)", nameRu: 'Ростовой (grower)', protein: 32, fcr: 1.6 },
  { id: 'finisher', nameUz: 'Yakunlovchi (finisher)', nameRu: 'Финишный (finisher)', protein: 28, fcr: 1.9 },
  { id: 'wheat', nameUz: "Bug'doy/kepak aralashmasi", nameRu: 'Пшеница/отруби', protein: 14, fcr: 3.5 },
];

const cache = { fish: null, feed: null, at: 0 };
const TTL = 15 * 60 * 1000;

async function fetchCatalog(colName, defaults) {
  try {
    const snap = await getDocs(query(collection(db, colName), limit(100)));
    const items = [];
    snap.forEach((d) => {
      const a = d.data() || {};
      if (a.active === false) return;
      items.push({ id: d.id, ...a });
    });
    return items.length ? items : defaults;
  } catch {
    return defaults;   // ruxsat/kolleksiya hali yo'q — zaxira katalog
  }
}

/** @returns {Promise<{fish:Array, feed:Array}>} */
export async function loadCatalogs({ force = false } = {}) {
  if (!force && cache.fish && Date.now() - cache.at < TTL) {
    return { fish: cache.fish, feed: cache.feed };
  }
  const [fish, feed] = await Promise.all([
    fetchCatalog('fishCatalog', DEFAULT_FISH),
    fetchCatalog('feedCatalog', DEFAULT_FEED),
  ]);
  cache.fish = fish; cache.feed = feed; cache.at = Date.now();
  return { fish, feed };
}

export function catalogName(item, isUz) {
  if (!item) return '';
  return (isUz ? item.nameUz : item.nameRu) || item.nameUz || item.nameRu || item.id || '';
}

export default { loadCatalogs, catalogName, DEFAULT_FISH, DEFAULT_FEED };
