// ============================================================
//  features/devices/views/claimView.js — Fermer: qurilma qo'shish
//  deviceId + activationKey + ko'l nomi -> ownershipService.requestClaim
//  (activationKey Firestore Rules'da tekshiriladi).
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { ownershipService } from '../../ownership/index.js';
import { authStore } from '../../auth/index.js';

function field(labelKey, input) {
  return el('div', { class: 'field' }, [el('label', { text: t(labelKey) }), input]);
}

export function renderClaim(ctx = {}) {
  const s = authStore.getState();
  const errEl = el('div', { class: 'form-err' });
  const idIn = el('input', { type: 'text', placeholder: 'AQ3F9A21BC', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const keyIn = el('input', { type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const nameIn = el('input', { type: 'text' });

  const btn = el('button', { class: 'btn', type: 'button', text: t('device.submitClaim') });
  btn.addEventListener('click', async () => {
    errEl.textContent = '';
    if (!idIn.value.trim() || !keyIn.value.trim()) { errEl.textContent = t('error.claimFields'); return; }
    btn.disabled = true;
    try {
      await ownershipService.requestClaim({
        deviceId: idIn.value,
        activationKey: keyIn.value,
        lakeName: nameIn.value,
        farmerRegion: s.profile ? s.profile.vil : '',
      }, s.uid);
      toast(t('device.claimSent'), 'ok');
      ctx.onBack && ctx.onBack();
    } catch (e) {
      // Rules rad etsa (noto'g'ri kalit / band / takroriy) -> tushunarli xabar
      const info = handleError(e, 'claim.submit');
      const key = String(e && e.code).includes('permission-denied') ? 'error.claimDenied' : info.messageKey;
      errEl.textContent = t(key);
      btn.disabled = false;
    }
  });

  return el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('device.claimTitle') }),
    el('div', { class: 'auth-wrap' }, [
      el('div', { class: 'card' }, [
        errEl,
        field('device.deviceId', idIn),
        field('device.activationKey', keyIn),
        field('device.lakeName', nameIn),
        btn,
        el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
      ]),
    ]),
  ]);
}

export default renderClaim;
