// ============================================================
//  features/ownership/views/pendingRequestsView.js
//  Admin: kutilayotgan claim so'rovlari (realtime) -> tasdiq/rad.
//  Region menejeri faqat o'z hududini ko'radi (service + rules).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { ownershipService } from '../services/ownershipService.js';
import { authStore } from '../../auth/index.js';

export function renderPendingRequests(ctx = {}) {
  const s = authStore.getState();
  const listEl = el('div', {});
  const container = el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('device.pendingTitle') }),
    el('div', { class: 'auth-wrap' }, [
      listEl,
      el('button', { class: 'btn ghost', type: 'button', text: t('common.back'), onClick: () => { if (unsub) unsub(); ctx.onBack && ctx.onBack(); } }),
    ]),
  ]);

  function row(req) {
    const approveBtn = el('button', { class: 'btn', style: 'width:auto;padding:8px 14px', text: t('device.approve') });
    const rejectBtn = el('button', { class: 'btn ghost', style: 'width:auto;padding:8px 14px', text: t('device.reject') });
    approveBtn.addEventListener('click', async () => {
      approveBtn.disabled = rejectBtn.disabled = true;
      try { await ownershipService.approveClaim(req.deviceId, s.uid); toast(t('device.approved'), 'ok'); }
      catch (e) { toast(t(handleError(e, 'approve').messageKey), 'err'); approveBtn.disabled = rejectBtn.disabled = false; }
    });
    rejectBtn.addEventListener('click', async () => {
      approveBtn.disabled = rejectBtn.disabled = true;
      try { await ownershipService.rejectClaim(req.deviceId, s.uid); toast(t('device.rejected'), 'ok'); }
      catch (e) { toast(t(handleError(e, 'reject').messageKey), 'err'); approveBtn.disabled = rejectBtn.disabled = false; }
    });
    return el('div', { class: 'card', style: 'margin-bottom:10px' }, [
      el('div', { style: 'font-family:var(--mono);font-weight:700', text: req.deviceId }),
      el('div', { style: 'font-size:13px;color:var(--ink-soft)', text: `${req.lakeName || ''} · ${req.region || ''}` }),
      el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [approveBtn, rejectBtn]),
    ]);
  }

  function render(requests) {
    if (!requests.length) {
      mount(listEl, el('div', { class: 'banner', text: t('device.noPending') }));
      return;
    }
    mount(listEl, ...requests.map(row));
  }

  const unsub = ownershipService.watchRequests(
    { role: s.role, regions: (s.userDoc && s.userDoc.regions) || [] },
    render,
  );

  return container;
}

export default renderPendingRequests;
