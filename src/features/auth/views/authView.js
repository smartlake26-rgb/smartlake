// ============================================================
//  features/auth/views/authView.js — Kirish / Ro'yxat / Parol tiklash
//  Uch rejim: login · register (profil maydonlari bilan) · forgot.
//  Validatsiya: authValidators (email/parol) + userValidators (profil).
//  Muvaffaqiyatli kirish/ro'yxatdan keyin router authStore orqali
//  avtomatik yo'naltiradi (bu view navigatsiya qilmaydi).
// ============================================================

import { el } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { t, getLocale } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';
import { authService } from '../services/authService.js';
import { authStore } from '../store/index.js';
import { validateLoginForm } from '../validators/authValidators.js';
import { userValidators } from '../../users/index.js';
import { AUTH_SCREENS } from '../constants/authConstants.js';

function field(labelKey, input) {
  return el('div', { class: 'field' }, [el('label', { text: t(labelKey) }), input]);
}

function regionSelect() {
  const sel = el('select', { class: 'sl-input' });
  sel.appendChild(el('option', { value: '', text: t('profile.selectRegion') }));
  VILOYATLAR.forEach((v) => sel.appendChild(el('option', { value: v, text: v })));
  return sel;
}

export function renderAuth(ctx = {}) {
  const mode = Object.values(AUTH_SCREENS).includes(ctx.mode) ? ctx.mode : AUTH_SCREENS.LOGIN;
  const errEl = el('div', { class: 'form-err' });

  const email = el('input', { type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'you@example.com' });
  const pass = el('input', { type: 'password', autocomplete: mode === AUTH_SCREENS.REGISTER ? 'new-password' : 'current-password', placeholder: '••••••' });

  // Register profil maydonlari
  const ism = el('input', { type: 'text', autocomplete: 'given-name' });
  const fam = el('input', { type: 'text', autocomplete: 'family-name' });
  const vil = regionSelect();
  const tum = el('input', { type: 'text' });
  const phone = el('input', { type: 'tel', inputmode: 'tel', placeholder: '+998 90 123 45 67' });

  const submitBtn = el('button', { class: 'btn', type: 'button' });

  function submitLabel() {
    return mode === AUTH_SCREENS.REGISTER ? t('auth.registerBtn')
      : mode === AUTH_SCREENS.FORGOT ? t('auth.sendReset')
        : t('auth.loginBtn');
  }
  function setBusy(busy, labelKey) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? t(labelKey) : submitLabel();
  }
  submitBtn.textContent = submitLabel();

  async function doLogin() {
    const check = validateLoginForm({ email: email.value, password: pass.value });
    if (!check.valid) { errEl.textContent = t(check.messageKey); return; }
    setBusy(true, 'auth.signingIn');
    try { await authService.signIn(email.value, pass.value); }
    catch (e) { errEl.textContent = t(handleError(e, 'auth.login').messageKey); setBusy(false); }
  }

  async function doRegister() {
    const cred = validateLoginForm({ email: email.value, password: pass.value });
    if (!cred.valid) { errEl.textContent = t(cred.messageKey); return; }
    const profile = { ism: ism.value, fam: fam.value, vil: vil.value, tum: tum.value, phone: phone.value };
    const prof = userValidators.validateProfile(profile);
    if (!prof.valid) { errEl.textContent = t(prof.messageKey); return; }
    setBusy(true, 'auth.creating');
    try {
      await authService.register(email.value, pass.value, profile, getLocale());
      await authStore.reload();   // userDoc yuklansin -> router yo'naltiradi
    } catch (e) { errEl.textContent = t(handleError(e, 'auth.register').messageKey); setBusy(false); }
  }

  async function doForgot() {
    if (!email.value.trim()) { errEl.textContent = t('error.emailRequired'); return; }
    setBusy(true, 'auth.sending');
    try {
      await authService.resetPassword(email.value);
      toast(t('auth.resetSent'), 'ok');
      ctx.onSwitch && ctx.onSwitch(AUTH_SCREENS.LOGIN);
    } catch (e) { errEl.textContent = t(handleError(e, 'auth.forgot').messageKey); setBusy(false); }
  }

  submitBtn.addEventListener('click', () => {
    errEl.textContent = '';
    if (mode === AUTH_SCREENS.REGISTER) doRegister();
    else if (mode === AUTH_SCREENS.FORGOT) doForgot();
    else doLogin();
  });

  const cardChildren = [
    el('div', { style: 'font-weight:800;font-size:17px;margin-bottom:14px', text: mode === AUTH_SCREENS.REGISTER ? t('auth.registerTitle') : mode === AUTH_SCREENS.FORGOT ? t('auth.forgotTitle') : t('auth.loginTitle') }),
    errEl,
  ];

  if (mode === AUTH_SCREENS.REGISTER) {
    cardChildren.push(
      field('profile.firstName', ism),
      field('profile.lastName', fam),
      field('profile.region', vil),
      field('profile.district', tum),
      field('profile.phone', phone),
    );
  }
  cardChildren.push(field('common.email', email));
  if (mode !== AUTH_SCREENS.FORGOT) cardChildren.push(field('common.password', pass));
  cardChildren.push(submitBtn);

  // Pastdagi navigatsiya havolalari
  const links = el('div', {}, []);
  if (mode === AUTH_SCREENS.LOGIN) {
    links.appendChild(el('div', { class: 'auth-switch', text: t('auth.toRegister'), onClick: () => ctx.onSwitch(AUTH_SCREENS.REGISTER) }));
    links.appendChild(el('div', { class: 'auth-switch', text: t('auth.forgotLink'), onClick: () => ctx.onSwitch(AUTH_SCREENS.FORGOT) }));
  } else {
    links.appendChild(el('div', { class: 'auth-switch', text: t('auth.toLogin'), onClick: () => ctx.onSwitch(AUTH_SCREENS.LOGIN) }));
  }

  return el('div', { class: 'app' }, [
    el('div', { class: 'auth-wrap center' }, [
      el('div', { class: 'auth-brand', html: `${icon('waves', 26)} ${t('app.name')}` }),
      el('div', { class: 'auth-sub', text: t('app.tagline') }),
      el('div', { class: 'card' }, cardChildren),
      links,
    ]),
  ]);
}

export default renderAuth;
