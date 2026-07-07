// ============================================================
//  features/telemetry/views/adminDashboard.js — Admin Dashboard
//  Stat kartalar + kutilayotgan so'rovlar + ogohlantirishlar (real).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { presence } from '../domain/freshness.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';
import { ROLES } from '../../../core/collections.js';

function stat(icName, value, label, color) {
  return el('div', { class: 'admin-stat' }, [
    el('div', { class: 'ic', style: `background:color-mix(in srgb, ${color} 16%, transparent);color:${color}`, html: icon(icName, 18) }),
    el('div', { class: 'n', text: String(value) }),
    el('div', { class: 'l', text: label }),
  ]);
}

export function renderAdminDashboard() {
  const wrap = el('div', {});

  function render() {
    const st = adminStore.getState();
    const farmers = st.users.filter((u) => u.role === ROLES.FARMER).length;
    let online = 0; let alerts = 0;
    const alertRows = [];
    st.devices.forEach((d) => {
      const tel = st.telemetry.get(d.id) || null;
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      if (tel && presence(tel.ts) === 'online') online += 1;
      const status = deviceStatus(tel, resolveThresholds(lake));
      if ([DEVICE_STATUS.CRITICAL, DEVICE_STATUS.WARNING, DEVICE_STATUS.OFFLINE].includes(status)) {
        alerts += 1; alertRows.push({ id: d.id, lake: lake ? lake.name : '—', status });
      }
    });

    const cards = el('div', { class: 'admin-cards' }, [
      stat('user', st.users.length, t('nav.users'), 'var(--md-primary)'),
      stat('user', farmers, t('role.farmer'), 'var(--md-tertiary)'),
      stat('droplet', st.lakes.length, t('nav.lakes'), 'var(--md-primary)'),
      stat('chip', st.devices.length, t('nav.devices'), 'var(--md-tertiary)'),
      stat('wifi', online, t('home.online'), 'var(--md-success)'),
      stat('bell', alerts, t('home.alerts'), alerts ? 'var(--md-critical)' : 'var(--md-neutral)'),
      stat('check', st.requests.length, t('nav.approvals'), 'var(--md-warning)'),
    ]);

    const pendingTable = dataTable({
      columns: [
        { key: 'deviceId', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.deviceId }) },
        { key: 'lakeName', label: t('device.lakeName') },
        { key: 'region', label: t('tm.region') },
      ],
      rows: st.requests, pageSize: 6, searchable: false,
      emptyText: t('alerts.none'),
    });

    const alertsTable = dataTable({
      columns: [
        { key: 'id', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.id }) },
        { key: 'lake', label: t('tm.lake') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('tm.status_' + r.status), r.status) },
      ],
      rows: alertRows, pageSize: 6, searchable: false, emptyText: t('alerts.allGood'),
    });

    mount(wrap, cards, el('div', { class: 'row2' }, [
      el('div', {}, [el('div', { class: 'panel-head', style: 'border:none;padding-left:2px' }, [el('div', { class: 't', text: t('nav.approvals') })]), pendingTable]),
      el('div', {}, [el('div', { class: 'panel-head', style: 'border:none;padding-left:2px' }, [el('div', { class: 't', text: t('nav.alerts') })]), alertsTable]),
    ]));
  }

  const unsub = adminStore.subscribe(render);
  render();
  wrap.__cleanup = unsub;
  return wrap;
}

export default renderAdminDashboard;
