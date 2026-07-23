// ============================================================
//  design-system/components/icons.js — SMARTLAKE DS 3.0 · IKONLAR
//  ------------------------------------------------------------
//  Yagona icon tizimi. Mavjud shared/icons.js registri QAYTA
//  ISHLATILADI (dublikat yaratilmaydi) va DS uchun zarur yangi
//  ikonlar shu yerda QO'SHIMCHA registrda saqlanadi — mavjud
//  faylga tegilmaydi.
//
//  O'lchamlar (token):  xs 16 · sm 20 · md 24 · lg 28 · xl 32 · xxl 40
//  Guruhlar (semantik xarita): navigation / status / sensor /
//  action / alert / ai — ekranlar nom emas, ROL bo'yicha so'raydi.
// ============================================================

import { icon as baseIcon } from '../../shared/icons.js';

/** Icon o'lcham tokenlari (px). */
export const ICON_SIZES = { xs: 16, sm: 20, md: 24, lg: 28, xl: 32, xxl: 40 };

/* DS uchun qo'shimcha yo'llar (24x24, stroke=currentColor).
   shared/icons.js dagi nomlar bilan to'qnashmaydi. */
const EXTRA_PATHS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M10 5.8A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.2 3.9M6.6 6.9A16.8 16.8 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8L4 5z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5"/><path d="M4 4h16"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
  trash: '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="m14 7 3 3"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m6 15 6-6 6 6"/>',
  alertTriangle: '<path d="M12 3.5 22 20H2L12 3.5z"/><path d="M12 10v4M12 17h.01"/>',
  sparkles: '<path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4L12 3z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/><path d="M5 16l.6 1.6L7 18l-1.4.6L5 20l-.6-1.4L3 18l1.4-.4L5 16z"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 3c0 1 .5 1.9 1.2 2.4A3 3 0 0 0 7 18c0 1.7 1.3 3 3 3h1V4H9z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 3c0 1-.5 1.9-1.2 2.4A3 3 0 0 1 17 18c0 1.7-1.3 3-3 3h-1V4h2z"/>',
  zap: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  fish: '<path d="M3 12s3.5-5 8.5-5c4 0 7 2.5 9.5 5-2.5 2.5-5.5 5-9.5 5C6.5 17 3 12 3 12z"/><circle cx="15.5" cy="11" r="1"/><path d="M3 12 5.5 9M3 12l2.5 3"/>',
  feed: '<path d="M6 20V10a6 6 0 0 1 12 0v10"/><path d="M4 20h16M9 10h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
  trendUp: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  trendDown: '<path d="M3 7l6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="17" cy="6" r="2.5"/><circle cx="17" cy="18" r="2.5"/><path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6"/>',
  cloudRain: '<path d="M17 15a4.5 4.5 0 0 0-1-8.9A5.5 5.5 0 0 0 5.3 8.2 4 4 0 0 0 6.5 16"/><path d="M8 18v2M12 17v3M16 18v2"/>',
};

/**
 * SVG ikon markup (stroke = currentColor).
 * @param {string} name  — ikon nomi (asosiy yoki DS registridan)
 * @param {number|keyof typeof ICON_SIZES} [size=24] — px yoki token nomi
 * @returns {string} SVG string
 */
export function slIcon(name, size = 'md') {
  const px = typeof size === 'number' ? size : (ICON_SIZES[size] || ICON_SIZES.md);
  const extra = EXTRA_PATHS[name];
  if (!extra) return baseIcon(name, px);   // asosiy registrga delegatsiya
  return `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${extra}</svg>`;
}

/* ------------------------------------------------------------
   Semantik guruhlar — ekranlar ikon NOMI emas, ROLI bo'yicha
   so'raydi: slIcon(ICONS.sensor.do). Nomlar bir joydan
   boshqariladi, kelajakda registr almashsa ekranlar o'zgarmaydi.
   ------------------------------------------------------------ */
export const ICONS = {
  navigation: {
    home: 'home', lakes: 'droplet', devices: 'chip', alerts: 'bell',
    profile: 'user', settings: 'settings', back: 'arrowLeft',
    forward: 'chevronRight', menu: 'menu', logout: 'logout',
  },
  status: {
    online: 'wifi', offline: 'power', healthy: 'check',
    warning: 'alertTriangle', critical: 'alertTriangle',
    info: 'info', unknown: 'info',
  },
  sensor: {
    do: 'waves', temp: 'thermometer', ph: 'activity',
    battery: 'battery', rssi: 'wifi', health: 'sun',
    aerator: 'power', energy: 'zap', feed: 'feed', fish: 'fish',
  },
  action: {
    add: 'plus', edit: 'edit', delete: 'trash', search: 'search',
    filter: 'filter', download: 'download', upload: 'upload',
    refresh: 'refresh', copy: 'copy', share: 'share',
    confirm: 'check', cancel: 'x', expand: 'chevronDown', collapse: 'chevronUp',
  },
  alert: {
    bell: 'bell', warning: 'alertTriangle', critical: 'alertTriangle', info: 'info',
  },
  ai: {
    advisor: 'sparkles', brain: 'brain', trendUp: 'trendUp',
    trendDown: 'trendDown', stable: 'minus',
  },
  misc: {
    calendar: 'calendar', clock: 'clock', weather: 'cloudRain',
    location: 'location', layers: 'layers', eye: 'eye', eyeOff: 'eyeOff',
  },
};

export default { slIcon, ICONS, ICON_SIZES };
