// ============================================================
//  features/auth/views/authView.js — Kirish / Ro'yxat / Parol tiklash v2
//
//  DS-4 REDESIGN (Design System v2 ustida, mantiq O'ZGARMAGAN):
//   • Hero: brend belgisi yumshoq "suv halqasi" ichida, nomi t-display
//   • Yuborishda tugma .is-loading (ichki spinner) — foydalanuvchi
//     jarayonni ko'radi, ikki marta bosmaydi
//   • Karta .lg tugma bilan, maydonlar orasi tokenlangan
//   • Xato banneri chiqishda yumshoq anim-up
//  Saqlangan: barcha validatorlar, authService chaqiruvlari, rejimlar
//  (LOGIN/REGISTER/FORGOT), i18n kalitlari, onSwitch oqimi, autocomplete.
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
  const err = el('div', { class: 'md-banner warn anim-up', style: 'display:none' });
  const setErr = (k) => { err.textContent = t(k); err.style.display = 'flex'; };

  const email = input({ type: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const pass = input({ type: 'password', autocomplete: mode === AUTH_SCREENS.REGISTER ? 'new-password' : 'current-password', placeholder: '••••••' });
  const ism = input({ type: 'text' });
  const fam = input({ type: 'text' });
  const vil = select([{ value: '', label: t('profile.selectRegion') }, ...VILOYATLAR.map((v) => ({ value: v, label: v }))], '');
  const tum = input({ type: 'text' });
  const phone = input({ type: 'tel', placeholder: '+998 90 123 45 67' });

  const btnLabel = mode === AUTH_SCREENS.REGISTER ? t('auth.registerBtn') : mode === AUTH_SCREENS.FORGOT ? t('auth.sendReset') : t('auth.loginBtn');
  const submit = mdButton({ label: btnLabel, full: true, onClick: run });
  submit.classList.add('lg');

  // Yuklanish holati: disabled + ichki spinner (DS .is-loading)
  const setBusy = (busy) => {
    submit.disabled = busy;
    submit.classList.toggle('is-loading', busy);
  };

  async function run() {
    err.style.display = 'none';
    if (mode === AUTH_SCREENS.FORGOT) {
      if (!email.value.trim()) return setErr('error.emailRequired');
      setBusy(true);
      try { await authService.resetPassword(email.value); toast(t('auth.resetSent'), 'ok'); ctx.onSwitch(AUTH_SCREENS.LOGIN); }
      catch (e) { setErr(handleError(e, 'forgot').messageKey); setBusy(false); }
      return;
    }
    const cred = validateLoginForm({ email: email.value, password: pass.value });
    if (!cred.valid) return setErr(cred.messageKey);
    setBusy(true);
    if (mode === AUTH_SCREENS.REGISTER) {
      const profile = { ism: ism.value, fam: fam.value, vil: vil.value, tum: tum.value, phone: phone.value };
      const pr = userValidators.validateProfile(profile);
      if (!pr.valid) { setBusy(false); return setErr(pr.messageKey); }
      try { await authService.register(email.value, pass.value, profile, getLocale()); await authStore.reload(); }
      catch (e) { setErr(handleError(e, 'register').messageKey); setBusy(false); }
    } else {
      try { await authService.signIn(email.value, pass.value); }
      catch (e) { setErr(handleError(e, 'login').messageKey); setBusy(false); }
    }
  }

  // Enter bilan yuborish (parol/email maydonidan) — kichik UX qulaylik
  [email, pass].forEach((f) => f.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); }));

  const formFields = [];
  if (mode === AUTH_SCREENS.REGISTER) {
    formFields.push(field(t('profile.firstName'), ism), field(t('profile.lastName'), fam), field(t('profile.region'), vil), field(t('profile.district'), tum), field(t('profile.phone'), phone));
  }
  formFields.push(field(t('common.email'), email));
  if (mode !== AUTH_SCREENS.FORGOT) formFields.push(field(t('common.password'), pass));

  const links = el('div', { style: 'text-align:center;margin-top:var(--sp-4)' });
  if (mode === AUTH_SCREENS.LOGIN) {
    links.append(
      el('button', { class: 'md-btn text', style: 'display:block;margin:0 auto', text: t('auth.toRegister'), onClick: () => ctx.onSwitch(AUTH_SCREENS.REGISTER) }),
      el('button', { class: 'md-btn text sm', style: 'display:block;margin:4px auto 0', text: t('auth.forgotLink'), onClick: () => ctx.onSwitch(AUTH_SCREENS.FORGOT) }),
    );
  } else {
    links.append(el('button', { class: 'md-btn text', style: 'display:block;margin:0 auto', text: t('auth.toLogin'), onClick: () => ctx.onSwitch(AUTH_SCREENS.LOGIN) }));
  }

  // --- HERO: brend belgisi "suv halqasi" ichida ---
  const hero = el('div', { class: 'anim-up', style: 'text-align:center;margin-bottom:var(--sp-5)' }, [
    el('div', {
      style: 'width:84px;height:84px;margin:0 auto var(--sp-3);border-radius:50%;'
        + 'display:flex;align-items:center;justify-content:center;color:var(--md-primary);'
        + 'background:radial-gradient(circle at 32% 28%, color-mix(in srgb, var(--md-tertiary) 22%, transparent), color-mix(in srgb, var(--md-primary) 12%, transparent));'
        + 'border:1px solid color-mix(in srgb, var(--md-primary) 22%, transparent);'
        + 'box-shadow: 0 0 0 10px color-mix(in srgb, var(--md-primary) 5%, transparent), var(--elev-2)',
      html: icon('waves', 40),
    }),
    el('div', { class: 't-display', style: 'color:var(--md-primary);letter-spacing:-.8px', text: t('app.name') }),
    el('div', { class: 't-body-sm muted', style: 'margin-top:4px', text: t('app.tagline') }),
  ]);

  const card = mdCard([
    el('div', { class: 't-title', style: 'margin-bottom:var(--sp-4)', text: mode === AUTH_SCREENS.REGISTER ? t('auth.registerTitle') : mode === AUTH_SCREENS.FORGOT ? t('auth.forgotTitle') : t('auth.loginTitle') }),
    err,
    el('div', { class: 'stack' }, [...formFields, submit]),
  ], { elevated: true });
  card.classList.add('anim-up');
  card.style.animationDelay = '80ms';
  card.style.animationFillMode = 'both';

  return el('div', { class: 'md-app' }, [
    el('div', { class: 'md-content no-nav', style: 'display:flex;flex-direction:column;justify-content:center;min-height:100dvh;padding-top:var(--sp-6);padding-bottom:var(--sp-6)' }, [
      hero,
      card,
      links,
    ]),
  ]);
}

export default renderAuth;
