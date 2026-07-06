// ============================================================
//  features/auth/views/settingsView.js — Sozlamalar
//  Til (uz/ru), parolni o'zgartirish (email orqali), email tasdig'i,
//  chiqish. Barcha amallar real (workaround yo'q).
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, getLocale, setLocale } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { LOCALES } from '../../../core/config.js';
import { authService } from '../services/authService.js';
import { authStore } from '../store/index.js';
import { userService } from '../../users/index.js';

function row(children) {
  return el('div', { class: 'set-row' }, children);
}

export function renderSettings(ctx = {}) {
  const s = authStore.getState();

  // --- Til tanlash ---
  const localeSel = el('select', {});
  LOCALES.forEach((l) => {
    const o = el('option', { value: l, text: l.toUpperCase() });
    if (l === getLocale()) o.selected = true;
    localeSel.appendChild(o);
  });
  localeSel.addEventListener('change', async () => {
    const l = localeSel.value;
    setLocale(l);
    try { if (s.uid) await userService.setLocale(s.uid, l); }
    catch (e) { handleError(e, 'settings.locale'); }
    ctx.onRerender && ctx.onRerender();
  });

  // --- Parolni o'zgartirish (email orqali reset) ---
  const pwBtn = el('button', { class: 'btn ghost', type: 'button', text: t('settings.changePassword') });
  pwBtn.addEventListener('click', async () => {
    pwBtn.disabled = true;
    try { await authService.resetPassword(s.email); toast(t('auth.resetSent'), 'ok'); }
    catch (e) { toast(t(handleError(e, 'settings.pw').messageKey), 'err'); }
    pwBtn.disabled = false;
  });

  // --- Chiqish ---
  const logoutBtn = el('button', { class: 'btn', type: 'button', text: t('common.logout') });
  logoutBtn.addEventListener('click', async () => {
    try { await authService.signOut(); }
    catch (e) { toast(t(handleError(e, 'settings.logout').messageKey), 'err'); }
  });

  const children = [
    row([el('span', { text: t('settings.language') }), localeSel]),
    row([el('span', { text: t('settings.password') }), pwBtn]),
  ];

  // --- Email tasdig'i (tasdiqlanmagan bo'lsa) ---
  if (!s.emailVerified) {
    const verifyBtn = el('button', { class: 'btn ghost', type: 'button', text: t('settings.resendVerification') });
    verifyBtn.addEventListener('click', async () => {
      verifyBtn.disabled = true;
      try { await authService.sendVerification(); toast(t('settings.verificationSent'), 'ok'); }
      catch (e) { toast(t(handleError(e, 'settings.verify').messageKey), 'err'); }
      verifyBtn.disabled = false;
    });
    children.push(row([el('span', { text: t('settings.emailUnverified') }), verifyBtn]));
  }

  children.push(el('div', { style: 'height:8px' }), logoutBtn);
  children.push(el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }));

  return el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('settings.title') }),
    el('div', { class: 'auth-wrap' }, [el('div', { class: 'card' }, children)]),
  ]);
}

export default renderSettings;
