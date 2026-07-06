// ============================================================
//  features/auth/views/profileView.js — Profilni ko'rish/tahrirlash
//  users/{uid}.profile ni yangilaydi (userService).
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';
import { userService, userValidators } from '../../users/index.js';
import { authStore } from '../store/index.js';

function field(labelKey, input) {
  return el('div', { class: 'field' }, [el('label', { text: t(labelKey) }), input]);
}

export function renderProfile(ctx = {}) {
  const s = authStore.getState();
  const p = s.profile || {};
  const errEl = el('div', { class: 'form-err' });

  const ism = el('input', { type: 'text', value: p.ism || '' });
  const fam = el('input', { type: 'text', value: p.fam || '' });
  const vil = el('select', {});
  vil.appendChild(el('option', { value: '', text: t('profile.selectRegion') }));
  VILOYATLAR.forEach((v) => {
    const o = el('option', { value: v, text: v });
    if (v === p.vil) o.selected = true;
    vil.appendChild(o);
  });
  const tum = el('input', { type: 'text', value: p.tum || '' });
  const phone = el('input', { type: 'tel', value: p.phone || '' });

  const saveBtn = el('button', { class: 'btn', type: 'button', text: t('common.save') });
  saveBtn.addEventListener('click', async () => {
    errEl.textContent = '';
    const profile = { ism: ism.value, fam: fam.value, vil: vil.value, tum: tum.value, phone: phone.value };
    const check = userValidators.validateProfile(profile);
    if (!check.valid) { errEl.textContent = t(check.messageKey); return; }
    saveBtn.disabled = true;
    try {
      await userService.updateProfile(s.uid, profile);
      await authStore.reload();
      toast(t('common.saved'), 'ok');
      ctx.onBack && ctx.onBack();
    } catch (e) { errEl.textContent = t(handleError(e, 'profile.save').messageKey); saveBtn.disabled = false; }
  });

  return el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('profile.title') }),
    el('div', { class: 'auth-wrap' }, [
      el('div', { class: 'card' }, [
        errEl,
        field('profile.firstName', ism),
        field('profile.lastName', fam),
        field('profile.region', vil),
        field('profile.district', tum),
        field('profile.phone', phone),
        saveBtn,
        el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
      ]),
    ]),
  ]);
}

export default renderProfile;
