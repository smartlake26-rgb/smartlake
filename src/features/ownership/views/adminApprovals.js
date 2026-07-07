// ============================================================
//  features/ownership/views/adminApprovals.js — Ko'l tasdig'i (admin)
//  Kutilayotgan claim so'rovlari + tasdiqlash/rad etish (realtime).
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { dataTable, mdButton, openDialog } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { authStore } from '../../auth/index.js';
import { ownershipService } from '../index.js';

export function renderAdminApprovals() {
  const wrap = el('div', {});
  const me = authStore.getState();

  async function act(fn, deviceId, okMsg) {
    try { await fn(deviceId, me.uid); await adminStore.refresh(); toast(okMsg, 'ok'); }
    catch (e) { toast(t(handleError(e, 'approval').messageKey), 'err'); }
  }

  function render() {
    const st = adminStore.getState();
    mount(wrap, dataTable({
      columns: [
        { key: 'deviceId', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.deviceId }) },
        { key: 'lakeName', label: t('device.lakeName') },
        { key: 'region', label: t('tm.region') },
        { key: '_act', label: '', sortable: false, render: (r) => el('div', { class: 'row', style: 'gap:6px' }, [
          mdButton({ label: t('common.approve'), variant: 'tonal', onClick: () => act(ownershipService.approveClaim, r.deviceId, t('approval.approved')) }),
          mdButton({ label: t('common.reject'), variant: 'text', onClick: () => openDialog({
            title: t('common.reject') + '?', body: r.deviceId,
            actions: [{ label: t('common.cancel'), variant: 'text' }, { label: t('common.reject'), variant: 'text', onClick: () => act(ownershipService.rejectClaim, r.deviceId, t('approval.rejected')) }],
          }) }),
        ]) },
      ],
      rows: st.requests, pageSize: 12, emptyText: t('approval.empty'),
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminApprovals;
