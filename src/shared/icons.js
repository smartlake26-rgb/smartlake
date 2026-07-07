// ============================================================
//  shared/icons.js — Outline SVG belgilari
//  Asl ilovadagi icon() to'plamidan (emoji EMAS — outline SVG).
//  Kelajakda barcha feature'lar shu yagona to'plamdan foydalanadi.
// ============================================================

const PATHS = {
  waves: '<path d="M3 7c1.5 0 1.5 1.4 3 1.4S7.5 7 9 7s1.5 1.4 3 1.4S13.5 7 15 7s1.5 1.4 3 1.4S19.5 7 21 7"/><path d="M3 12c1.5 0 1.5 1.4 3 1.4S7.5 12 9 12s1.5 1.4 3 1.4S13.5 12 15 12s1.5 1.4 3 1.4S19.5 12 21 12"/><path d="M3 17c1.5 0 1.5 1.4 3 1.4S7.5 17 9 17s1.5 1.4 3 1.4S13.5 17 15 17s1.5 1.4 3 1.4S19.5 17 21 17"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  lock: '<rect x="4.5" y="11" width="15" height="9.5" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 5.5L20.5 7"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.3 2.3 3.6 5.3 3.6 8.5S14.3 18.2 12 20.5c-2.3-2.3-3.6-5.3-3.6-8.5S9.7 5.8 12 3.5z"/>',
  power: '<path d="M12 3.5v8"/><path d="M6.8 6.8a7.5 7.5 0 1 0 10.4 0"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  droplet: '<path d="M12 3.5s6 6.2 6 10.3a6 6 0 0 1-12 0C6 9.7 12 3.5 12 3.5z"/>',
  arrowLeft: '<path d="M15 5l-7 7 7 7"/>',
};

/**
 * SVG belgisi qaytaradi (string).
 * @param {string} name
 * @param {number} [size=22]
 * @returns {string}
 */
export function icon(name, size = 22) {
  const body = PATHS[name] || '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" `
    + 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
    + 'stroke-linecap="round" stroke-linejoin="round" '
    + `style="display:inline-block;vertical-align:middle">${body}</svg>`;
}

export default icon;
