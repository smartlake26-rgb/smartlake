// ============================================================
//  features/telemetry/views/notificationsTab.js — Bildirishnomalar
//  Ogohlantirishlar telemetriyadan (statusEngine) HISOBLANADI —
//  yangi backend yo'q. warning/critical/offline qurilmalar.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { appBar, mdCard, statusChip, listItem, skeletonCards, emptyState } from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';
import { renderDeviceDetailPage } from './deviceDetailPage.js';

const ALERT = new Set([DEVICE_STATUS.CRITICAL, DEVICE_STATUS.WARNING, DEVICE_STATUS.OFFLINE]);

export function renderNotificationsTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('nav.alerts') }), content]);

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const alerts = [];
    st.devices.forEach((d) => {
      const lake = st.lakes.find((l) => l.id === d.lakeId);
      const status = deviceStatus(st.telemetry.get(d.id) || null, resolveThresholds(lake));
      if (ALERT.has(status)) alerts.push({ d, lake, status });
    });
    if (!alerts.length) {
      mount(content, emptyState({ icon: 'check', title: t('alerts.none'), desc: t('alerts.allGood') }));
      return;
    }
    mount(content, mdCard([el('div', { class: 'md-list' }, alerts.map(({ d, lake, status }) => listItem({
      leading: status === DEVICE_STATUS.OFFLINE ? 'wifi' : 'info',
      title: `${d.id} · ${t('tm.status_' + status)}`,
      subtitle: lake ? lake.name : t('device.unassigned'),
      trailing: statusChip(status, t('tm.status_' + status)),
      onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
    })))], { cls: 'anim-up' }));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderNotificationsTab;
