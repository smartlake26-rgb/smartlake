// ============================================================
//  features/devices/views/devicesTab.js — Qurilmalar tab
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { authStore } from '../../auth/index.js';
import { appBar, mdIconButton, mdCard, statusChip, listItem, skeletonCards, emptyState, mdFab } from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';
import { renderDeviceDetailPage } from '../../telemetry/views/deviceDetailPage.js';
import { renderClaimPage } from './claimPage.js';
import { openAdminProvisionPage } from './deviceClaimFlow.js';

export function renderDevicesTab(nav) {
  const s = authStore.getState ? authStore.getState() : {};
  const isAdmin = s.role === 'super' || s.role === 'admin';
  const addAction = isAdmin
    ? () => nav.push((n) => openAdminProvisionPage(n))
    : () => nav.push(renderClaimPage);

  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('nav.devices'), actions: [mdIconButton({ icon: 'plus', label: t('device.claimTitle'), onClick: addAction })] }),
    content,
    mdFab({ label: t('device.claimTitle'), icon: 'plus', onClick: addAction }),
  ]);

  function row(d, st) {
    const tel = st.telemetry.get(d.id) || null;
    const lake = st.lakes.find((l) => l.id === d.lakeId);
    return listItem({
      leading: 'chip',
      title: d.id,
      subtitle: lake ? lake.name : t('device.unassigned'),
      trailing: statusChip(deviceStatus(tel, resolveThresholds(lake)), t('tm.status_' + deviceStatus(tel, resolveThresholds(lake)))),
      onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
    });
  }

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.devices.length) {
      mount(content, emptyState({ icon: 'chip', title: t('device.empty'), desc: t('device.emptyHint') }));
      return;
    }
    mount(content, mdCard([el('div', { class: 'md-list' }, st.devices.map((d) => row(d, st)))], { cls: 'anim-up' }));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderDevicesTab;
