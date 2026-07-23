// ============================================================
//  design-system/index.js — SMARTLAKE DS 3.0 · YAGONA JS KIRISH
//  ------------------------------------------------------------
//  Ekranlar uchun qulay bitta import nuqtasi:
//    import { slButton, slLakeCard } from '../design-system/index.js';
//  CSS alohida import qilinadi (index.css) — Vite ikkalasini ham
//  bitta bundle'ga yig'adi.
//  Theme boshqaruvi uchun mavjud shared/ui/theme.js QAYTA
//  ISHLATILADI (dublikat yaratilmagan).
// ============================================================

export * from './components/index.js';
export { initTheme, toggleTheme, getTheme, setTheme } from '../shared/ui/theme.js';
