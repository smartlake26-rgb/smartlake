// ============================================================
//  features/auth/views/profileEditPage.js — Profilni tahrirlash
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input, select } from '../../../shared/ui/index.js';
import { authStore } from '../index.js';
import { userService, userValidators } from '../../users/index.js';

export function renderProfileEditPage(nav) {
  const s = authStore.getState();
  const p = s.profile || {};
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });

  const ism = input({ type: 'text', value: p.ism || '' });
  const fam = input({ type: 'text', value: p.fam || '' });
  const vil = select([{ value: '', label: t('profile.selectRegion') }, ...VILOYATLAR.map((v) => ({ value: v, label: v }))], p.vil);
  const tum = input({ type: 'text', value: p.tum || '' });
  const phone = input({ type: 'tel', value: p.phone || '' });

  const save = mdButton({ label: t('common.save'), full: true, onClick: async () => {
    err.style.display = 'none';
    const profile = { ism: ism.value, fam: fam.value, vil: vil.value, tum: tum.value, phone: phone.value };
    const check = userValidators.validateProfile(profile);
    if (!check.valid) { err.textContent = t(check.messageKey); err.style.display = 'flex'; return; }
    save.disabled = true;
    try {
      await userService.updateProfile(s.uid, profile);
      await authStore.reload();
      toast(t('common.saved'), 'ok');
      nav.back();
    } catch (e) { err.textContent = t(handleError(e, 'profile.save').messageKey); err.style.display = 'flex'; save.disabled = false; }
  } });

  return el('div', { class: 'md-app' }, [
    appBar({ title: t('profile.title'), leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    el('div', { class: 'md-content no-nav' }, [
      mdCard([
        err,
        el('div', { class: 'stack' }, [
          field(t('profile.firstName'), ism),
          field(t('profile.lastName'), fam),
          field(t('profile.region'), vil),
          field(t('profile.district'), tum),
          field(t('profile.phone'), phone),
          save,
        ]),
      ], { elevated: true }),
    ]),
  ]);
}

export default renderProfileEditPage;
