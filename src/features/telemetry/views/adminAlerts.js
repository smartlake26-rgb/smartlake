// ============================================================
//  features/telemetry/views/adminAlerts.js — Ogohlantirishlar (admin, hisoblangan)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';

const ALERT = [DEVICE_STATUS.CRITICAL, DEVICE_STATUS.WARNING, DEVICE_STATUS.OFFLINE];
const sev = { critical: 3, warning: 2, offline: 1 };

export function renderAdminAlerts() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const rows = [];
    st.devices.forEach((d) => {
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      const owner = st.users.find((u) => u.uid === d.ownerUid);
      const status = deviceStatus(st.telemetry.get(d.id) || null, resolveThresholds(lake));
      if (ALERT.includes(status)) rows.push({ id: d.id, lake: lake ? lake.name : '—',
        owner: owner ? `${owner.profile?.ism || ''} ${owner.profile?.fam || ''}`.trim() : '—',
        region: d.region || '—', status, sev: sev[status] || 0 });
    });
    rows.sort((a, b) => b.sev - a.sev);
    mount(wrap, dataTable({
      columns: [
        { key: 'id', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.id }) },
        { key: 'lake', label: t('tm.lake') },
        { key: 'owner', label: t('tm.owner') },
        { key: 'region', label: t('tm.region') },
        { key: 'status', label: t('tm.status'), value: (r) => r.sev, render: (r) => pill(t('tm.status_' + r.status), r.status) },
      ],
      rows, pageSize: 16, emptyText: t('alerts.allGood'),
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminAlerts;
