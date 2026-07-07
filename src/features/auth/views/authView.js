// ============================================================
//  features/auth/views/authView.js — Kirish / Ro'yxat / Parol tiklash (MD3)
// ============================================================

import { el } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { t, getLocale } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';
import { mdButton, mdCard, field, input, select } from '../../../shared/ui/index.js';
import { authService } from '../services/authService.js';
import { authStore } from '../store/index.js';
import { validateLoginForm } from '../validators/authValidators.js';
import { userValidators } from '../../users/index.js';
import { AUTH_SCREENS } from '../constants/authConstants.js';

export function renderAuth(ctx = {}) {
  const mode = Object.values(AUTH_SCREENS).includes(ctx.mode) ? ctx.mode : AUTH_SCREENS.LOGIN;
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });
  const setErr = (k) => { err.textContent = t(k); err.style.display = 'flex'; };

  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const pass = input({ type: 'password', autocomplete: mode === AUTH_SCREENS.REGISTER ? 'new-password' : 'current-password', placeholder: '******' });
  const ism = input({ type: 'text' });
  const fam = input({ type: 'text' });
  const vil = select([{ value: '', label: t('profile.selectRegion') }, ...VILOYATLAR.map((v) => ({ value: v, label: v }))], '');
  const tum = input({ type: 'text' });
  const phone = input({ type: 'tel', placeholder: '+998 90 123 45 67' });

  const btnLabel = mode === AUTH_SCREENS.REGISTER ? t('auth.registerBtn') : mode === AUTH_SCREENS.FORGOT ? t('auth.sendReset') : t('auth.loginBtn');
  const submit = mdButton({ label: btnLabel, full: true, onClick: run });
  async function run() {
    err.style.display = 'none';
    if (mode === AUTH_SCREENS.FORGOT) {
      if (!email.value.trim()) return setErr('error.emailRequired');
      submit.disabled = true;
      try { await authService.resetPassword(email.value); toast(t('auth.resetSent'), 'ok'); ctx.onSwitch(AUTH_SCREENS.LOGIN); }
      catch (e) { setErr(handleError(e, 'forgot').messageKey); submit.disabled = false; }
      return;
    }
    const cred = validateLoginForm({ email: email.value, password: pass.value });
    if (!cred.valid) return setErr(cred.messageKey);
    submit.disabled = true;
    if (mode === AUTH_SCREENS.REGISTER) {
      const profile = { ism: ism.value, fam: fam.value, vil: vil.value, tum: tum.value, phone: phone.value };
      const pr = userValidators.validateProfile(profile);
      if (!pr.valid) { submit.disabled = false; return setErr(pr.messageKey); }
      try { await authService.register(email.value, pass.value, profile, getLocale()); await authStore.reload(); }
      catch (e) { setErr(handleError(e, 'register').messageKey); submit.disabled = false; }
    } else {
      try { await authService.signIn(email.value, pass.value); }
      catch (e) { setErr(handleError(e, 'login').messageKey); submit.disabled = false; }
    }
  }

  const formFields = [];
  if (mode === AUTH_SCREENS.REGISTER) {
    formFields.push(field(t('profile.firstName'), ism), field(t('profile.lastName'), fam), field(t('profile.region'), vil), field(t('profile.district'), tum), field(t('profile.phone'), phone));
  }
  formFields.push(field(t('common.email'), email));
  if (mode !== AUTH_SCREENS.FORGOT) formFields.push(field(t('common.password'), pass));

  const links = el('div', { style: 'text-align:center;margin-top:14px' });
  if (mode === AUTH_SCREENS.LOGIN) {
    links.append(
      el('button', { class: 'md-btn text', style: 'display:block;margin:0 auto', text: t('auth.toRegister'), onClick: () => ctx.onSwitch(AUTH_SCREENS.REGISTER) }),
      el('button', { class: 'md-btn text', style: 'display:block;margin:0 auto', text: t('auth.forgotLink'), onClick: () => ctx.onSwitch(AUTH_SCREENS.FORGOT) }),
    );
  } else {
    links.append(el('button', { class: 'md-btn text', style: 'display:block;margin:0 auto', text: t('auth.toLogin'), onClick: () => ctx.onSwitch(AUTH_SCREENS.LOGIN) }));
  }

  return el('div', { class: 'md-app' }, [
    el('div', { class: 'md-content no-nav', style: 'display:flex;flex-direction:column;justify-content:center;min-height:100dvh' }, [
      el('div', { style: 'text-align:center;margin-bottom:22px' }, [
        el('div', { style: 'color:var(--md-primary)', html: icon('waves', 44) }),
        el('div', { class: 't-headline', style: 'color:var(--md-primary)', text: t('app.name') }),
        el('div', { class: 't-body-sm muted', text: t('app.tagline') }),
      ]),
      mdCard([
        el('div', { class: 't-title', style: 'margin-bottom:14px', text: mode === AUTH_SCREENS.REGISTER ? t('auth.registerTitle') : mode === AUTH_SCREENS.FORGOT ? t('auth.forgotTitle') : t('auth.loginTitle') }),
        err,
        el('div', { class: 'stack' }, [...formFields, submit]),
      ], { elevated: true }),
      links,
    ]),
  ]);
}

export default renderAuth;
