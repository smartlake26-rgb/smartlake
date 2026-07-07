// ============================================================
//  features/telemetry/views/adminMonitoring.js — Realtime Monitoring (admin)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { telemetryAge } from '../domain/freshness.js';

function age(ts) { const a = telemetryAge(ts); if (a == null) return '—'; const m = Math.floor(a / 60000); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h'; }

export function renderAdminMonitoring() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const rows = st.devices.map((d) => {
      const tel = st.telemetry.get(d.id) || null;
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      return { id: d.id, lake: lake ? lake.name : '—',
        do: tel ? tel.do : null, t: tel ? tel.t : null, ph: tel ? tel.ph : null,
        rssi: tel ? tel.rssi : null, age: age(tel ? tel.ts : null),
        status: deviceStatus(tel, resolveThresholds(lake)) };
    });
    mount(wrap, dataTable({
      columns: [
        { key: 'id', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.id }) },
        { key: 'lake', label: t('tm.lake') },
        { key: 'do', label: 'DO' },
        { key: 't', label: t('tm.temp') },
        { key: 'ph', label: 'pH' },
        { key: 'rssi', label: 'RSSI' },
        { key: 'age', label: t('tm.telemetryAge'), sortable: false },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('tm.status_' + r.status), r.status) },
      ],
      rows, pageSize: 16,
      filters: [{ key: 'status', label: t('tm.status'), options: ['healthy', 'good', 'warning', 'critical', 'offline', 'unknown'].map((s) => ({ value: s, label: t('tm.status_' + s) })) }],
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminMonitoring;
