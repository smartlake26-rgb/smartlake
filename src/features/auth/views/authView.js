// ============================================================
//  features/auth/views/authView.js — Kirish/Ro'yxatdan o'tish ekrani
//  DOM ni xavfsiz `el()` yordamchilari bilan quradi (innerHTML emas).
//  Validatsiya -> authValidators; kirish -> authService.
// ============================================================

import { el } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { authService } from '../services/authService.js';
import { validateLoginForm, validateRegisterForm } from '../validators/authValidators.js';

/**
 * Auth ekranini render qiladi.
 * @param {object} ctx
 * @param {'login'|'register'} [ctx.mode='login']
 * @param {(mode:string)=>void} [ctx.onSwitch]  Rejim almashtirish (login<->register).
 * @returns {HTMLElement}
 */
export function renderAuth(ctx = {}) {
  const mode = ctx.mode === 'register' ? 'register' : 'login';

  const errEl = el('div', { class: 'form-err' });
  const emailInput = el('input', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const passInput = el('input', { type: 'password', autocomplete: mode === 'register' ? 'new-password' : 'current-password', placeholder: '••••••' });
  const submitBtn = el('button', {
    class: 'btn',
    type: 'button',
    text: mode === 'register' ? t('auth.registerBtn') : t('auth.loginBtn'),
  });

  function setBusy(busy, labelKey) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy
      ? t(labelKey)
      : (mode === 'register' ? t('auth.registerBtn') : t('auth.loginBtn'));
  }

  async function submit() {
    errEl.textContent = '';
    const email = emailInput.value;
    const password = passInput.value;

    const check = mode === 'register'
      ? validateRegisterForm({ email, password })
      : validateLoginForm({ email, password });
    if (!check.valid) { errEl.textContent = t(check.messageKey); return; }

    setBusy(true, mode === 'register' ? 'auth.creating' : 'auth.signingIn');
    try {
      if (mode === 'register') await authService.register(email, password);
      else await authService.signIn(email, password);
      // Muvaffaqiyat -> onAuthChange (main.js) ekranni almashtiradi.
    } catch (e) {
      const { messageKey } = handleError(e, 'authView.submit');
      errEl.textContent = t(messageKey);
      setBusy(false);
    }
  }

  passInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });
  submitBtn.addEventListener('click', submit);

  const switchLink = el('div', {
    class: 'auth-switch',
    text: mode === 'register' ? t('auth.toLogin') : t('auth.toRegister'),
    onClick: () => ctx.onSwitch && ctx.onSwitch(mode === 'register' ? 'login' : 'register'),
  });

  return el('div', { class: 'app' }, [
    el('div', { class: 'auth-wrap' }, [
      el('div', { class: 'auth-brand', html: `${icon('waves', 26)} ${t('app.name')}` }),
      el('div', { class: 'auth-sub', text: t('app.tagline') }),
      el('div', { class: 'card' }, [
        el('div', { style: 'font-weight:800;font-size:17px;margin-bottom:14px;color:var(--ink)', text: mode === 'register' ? t('auth.registerTitle') : t('auth.loginTitle') }),
        errEl,
        el('div', { class: 'field' }, [el('label', { text: t('common.email') }), emailInput]),
        el('div', { class: 'field' }, [el('label', { text: t('common.password') }), passInput]),
        submitBtn,
      ]),
      switchLink,
    ]),
  ]);
}

export default renderAuth;
