// ============================================================
//  features/devices/views/adminDevices.js — Qurilmalar jadvali (admin)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';

export function renderAdminDevices() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const rows = st.devices.map((d) => {
      const owner = st.users.find((u) => u.uid === d.ownerUid);
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      return { ...d, ownerName: owner ? `${owner.profile?.ism || ''} ${owner.profile?.fam || ''}`.trim() : '—',
        lakeName: lake ? lake.name : '—', status: deviceStatus(st.telemetry.get(d.id) || null, resolveThresholds(lake)) };
    });
    mount(wrap, dataTable({
      columns: [
        { key: 'id', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.id }) },
        { key: 'ownerName', label: t('tm.owner') },
        { key: 'lakeName', label: t('tm.lake') },
        { key: 'region', label: t('tm.region') },
        { key: 'lifecycle', label: t('device.lifecycle'), render: (r) => pill(r.lifecycle || '—', 'neutral') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('tm.status_' + r.status), r.status) },
      ],
      rows, pageSize: 14,
      filters: [{ key: 'status', label: t('tm.status'), options: ['healthy', 'good', 'warning', 'critical', 'offline', 'unknown'].map((s) => ({ value: s, label: t('tm.status_' + s) })) }],
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminDevices;
