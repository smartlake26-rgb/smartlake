// ============================================================
//  shared/ui/theme.js — Light/Dark rejim (saqlanadi)
// ============================================================

const KEY = 'sl_theme';

/** Saqlangan yoki tizim rejimini qo'llaydi (ilova boshida chaqiriladi). */
export function initTheme() {
  let t = null;
  try { t = localStorage.getItem(KEY); } catch (_) { /* private mode */ }
  if (!t) t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  applyTheme(t);
  return t;
}

export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Almashtiradi va saqlaydi. Yangi rejimni qaytaradi. */
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(KEY, next); } catch (_) { /* ignore */ }
  return next;
}

export function setTheme(t) {
  applyTheme(t);
  try { localStorage.setItem(KEY, t); } catch (_) { /* ignore */ }
}

export default { initTheme, applyTheme, getTheme, toggleTheme, setTheme };
