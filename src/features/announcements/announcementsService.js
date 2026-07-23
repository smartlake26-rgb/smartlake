// ============================================================
//  features/announcements/announcementsService.js — E'LONLAR (ANN-V1)
//  SuperAdmin -> fermerlarga: yangiliklar, video darslar, muhim
//  ogohlantirishlar, texnik xizmat xabarlari, tavsiyalar.
//
//  ARXITEKTURA (hozircha UI-tayyor bosqich):
//  - O'QISH-FAQAT: `announcements` kolleksiyasidan o'qiydi.
//    Hujjat modeli (admin tomoni keyingi bosqichda yozadi):
//      { type: 'news'|'video'|'warning'|'maintenance'|'tip',
//        title, body, link?, active: true, createdAt }
//  - Firestore STRUKTURASIGA/RULES'GA TEGILMAGAN: kolleksiya yoki
//    ruxsat hali mavjud bo'lmasa, xizmat XAVFSIZ ravishda null
//    qaytaradi va UI "hozircha e'lon yo'q" holatini ko'rsatadi.
//  - Hech qanday yozish yo'li YO'Q (business logic o'zgarmagan).
// ============================================================

import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../../core/firebase.js';

export const ANN_TYPES = ['news', 'video', 'warning', 'maintenance', 'tip'];

/** type -> DS icon nomi va rang tokeni (prezentatsiya xaritasi). */
export const ANN_STYLE = {
  news: { icon: 'info', colorVar: '--sl-info' },
  video: { icon: 'eye', colorVar: '--sl-primary' },
  warning: { icon: 'alertTriangle', colorVar: '--sl-warning' },
  maintenance: { icon: 'settings', colorVar: '--sl-offline' },
  tip: { icon: 'sparkles', colorVar: '--sl-ai' },
};

const tsMs = (v) => (v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0));

let cache = null;          // { at, items } — sessiya keshi
const TTL = 10 * 60 * 1000;

/**
 * Faol e'lonlar (yangi -> eski).
 * @returns {Promise<Array|null>} null = manba hali mavjud emas/ruxsat yo'q
 */
export async function fetchAnnouncements({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < TTL) return cache.items;
  try {
    const snap = await getDocs(query(collection(db, 'announcements'), limit(50)));
    const items = [];
    snap.forEach((d) => {
      const a = d.data() || {};
      if (a.active === false) return;
      items.push({
        id: d.id,
        type: ANN_TYPES.includes(a.type) ? a.type : 'news',
        title: String(a.title || ''),
        body: String(a.body || ''),
        link: a.link ? String(a.link) : null,
        createdAt: tsMs(a.createdAt),
      });
    });
    items.sort((a, b) => b.createdAt - a.createdAt);
    cache = { at: Date.now(), items };
    return items;
  } catch {
    // Kolleksiya/ruxsat hali yo'q — arxitektura tayyor, ma'lumot keyin keladi
    cache = { at: Date.now(), items: null };
    return null;
  }
}

export default { fetchAnnouncements, ANN_TYPES, ANN_STYLE };
