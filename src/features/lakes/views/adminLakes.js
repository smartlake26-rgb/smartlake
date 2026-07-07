// ============================================================
//  features/lakes/views/adminLakes.js — Ko'llar jadvali (admin)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';

export function renderAdminLakes() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const rows = st.lakes.map((l) => {
      const owner = st.users.find((u) => u.uid === l.ownerUid);
      return { ...l, ownerName: owner ? `${owner.profile?.ism || ''} ${owner.profile?.fam || ''}`.trim() : '—',
        deviceCount: (l.deviceIds || []).length };
    });
    mount(wrap, dataTable({
      columns: [
        { key: 'name', label: t('lake.name') },
        { key: 'ownerName', label: t('tm.owner') },
        { key: 'region', label: t('tm.region') },
        { key: 'district', label: t('lake.district') },
        { key: 'deviceCount', label: t('lake.devices') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('lake.status_' + (r.status || 'active')), r.status === 'archived' ? 'offline' : r.status === 'inactive' ? 'warning' : 'active') },
      ],
      rows, pageSize: 14,
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminLakes;
