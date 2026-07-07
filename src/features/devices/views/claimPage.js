// ============================================================
//  features/devices/views/claimPage.js — Qurilma qo'shish (claim)
// ============================================================

import { el } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { appBar, mdIconButton, mdCard, mdButton, field, input, banner } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import { ownershipService } from '../../ownership/index.js';
import * as dataStore from '../../../farmer/dataStore.js';

export function renderClaimPage(nav) {
  const s = authStore.getState();
  const err = el('div', { class: 'md-banner warn', style: 'display:none' });
  const idIn = input({ type: 'text', placeholder: 'AQ3F9A21BC', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const keyIn = input({ type: 'text', placeholder: 'XXXX-XXXX-XXXX-XXXX', style: 'text-transform:uppercase;font-family:var(--mono)' });
  const nameIn = input({ type: 'text' });

  const submit = mdButton({ label: t('device.submitClaim'), full: true, onClick: async () => {
    err.style.display = 'none';
    if (!idIn.value.trim() || !keyIn.value.trim()) { err.textContent = t('error.claimFields'); err.style.display = 'flex'; return; }
    submit.disabled = true;
    try {
      await ownershipService.requestClaim({ deviceId: idIn.value, activationKey: keyIn.value, lakeName: nameIn.value, farmerRegion: s.profile ? s.profile.vil : '' }, s.uid);
      toast(t('device.claimSent'), 'ok');
      await dataStore.refresh();
      nav.back();
    } catch (e) {
      const info = handleError(e, 'claim');
      err.textContent = t(String(e && e.code).includes('permission-denied') ? 'error.claimDenied' : info.messageKey);
      err.style.display = 'flex'; submit.disabled = false;
    }
  } });

  return el('div', { class: 'md-app' }, [
    appBar({ title: t('device.claimTitle'), leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    el('div', { class: 'md-content no-nav' }, [
      banner('info', t('device.claimHint')),
      el('div', { style: 'height:12px' }),
      mdCard([
        err,
        el('div', { class: 'stack' }, [
          field(t('device.deviceId'), idIn),
          field(t('device.activationKey'), keyIn),
          field(t('device.lakeName'), nameIn),
          submit,
        ]),
      ], { elevated: true }),
    ]),
  ]);
}

export default renderClaimPage;
