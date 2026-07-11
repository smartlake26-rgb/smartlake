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
import * as dataStore from '../../../farmer/dataStore.js';

function field(labelKey, input) {
  return el('div', { class: 'field' }, [el('label', { text: t(labelKey) }), input]);
}

export function renderClaim(ctx = {}) {
  const s = authStore.getState();
  const errEl = el('div', { class: 'form-err' });
  const idIn = el('input', { type: 'text', placeholder: 'AQ3F9A21BC', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const keyIn = el('input', { type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const nameIn = el('input', { type: 'text' });

  const userLakes = dataStore.getState().lakes || [];
  const lakeSelect = el('select', { style: 'width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--md-outline-variant); background: var(--md-surface-container); color: var(--md-on-surface); margin-bottom: 12px; font-size: 14px;' });
  
  const optNew = el('option', { value: 'new', text: "Yangi ko'l yaratish..." });
  lakeSelect.appendChild(optNew);
  userLakes.forEach(lake => {
    lakeSelect.appendChild(el('option', { value: lake.id, text: lake.name }));
  });

  const nameField = field('device.lakeName', nameIn);

  lakeSelect.addEventListener('change', () => {
    if (lakeSelect.value === 'new') {
      nameField.style.display = 'block';
    } else {
      nameField.style.display = 'none';
    }
  });

  const btn = el('button', { class: 'btn', type: 'button', text: t('device.submitClaim') });
  btn.addEventListener('click', async () => {
    errEl.textContent = '';
    if (!idIn.value.trim() || !keyIn.value.trim()) { errEl.textContent = t('error.claimFields'); return; }
    
    const isNew = lakeSelect.value === 'new';
    const selectedLakeId = isNew ? '' : lakeSelect.value;
    const selectedLakeName = isNew ? nameIn.value.trim() : (userLakes.find(l => l.id === selectedLakeId)?.name || '');

    if (isNew && !selectedLakeName) {
      errEl.textContent = "Iltimos, ko'l nomini kiriting yoki ro'yxatdan tanlang";
      return;
    }

    btn.disabled = true;
    try {
      await ownershipService.requestClaim({
        deviceId: idIn.value,
        activationKey: keyIn.value,
        lakeName: selectedLakeName,
        lakeId: selectedLakeId,
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
        el('div', { class: 'field' }, [
          el('label', { text: "Ko'lni tanlang" }),
          lakeSelect
        ]),
        nameField,
        btn,
        el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
      ]),
    ]),
  ]);
}

export default renderClaim;
