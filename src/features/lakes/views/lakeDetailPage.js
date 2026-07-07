// ============================================================
//  features/lakes/views/lakeDetailPage.js — Ko'l tafsilotlari
//  Gauge + sensor kartalari + qurilmalar (biriktirish/ajratish) +
//  amallar (tahrirlash, faol/nofaol, arxivlash). Realtime.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import {
  appBar, mdIconButton, mdCard, mdButton, statusChip, sensorCard, listItem,
  select, emptyState, openDialog, skeletonCards,
} from '../../../shared/ui/index.js';
import { gauge } from '../../../shared/ui/gauge.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { authStore } from '../../auth/index.js';
import { lakeService, deviceAssignmentService } from '../index.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { deviceStatus } from '../../telemetry/domain/statusEngine.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { renderDeviceDetailPage } from '../../telemetry/views/deviceDetailPage.js';

function healthColor(s) { return s >= 90 ? 'var(--md-success)' : s >= 60 ? 'var(--md-warning)' : 'var(--md-critical)'; }

export function renderLakeDetailPage(nav, lakeId) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title', text: t('lake.detail') });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [
      mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }),
      el('div', { class: 'grow' }, [titleEl]),
      mdIconButton({ icon: 'settings', onClick: () => { const lk = dataStore.getState().lakes.find((l) => l.id === lakeId); if (lk) nav.push((n) => renderLakeFormPage(n, lk)); } }),
    ]),
    content,
  ]);

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const lake = st.lakes.find((l) => l.id === lakeId);
    if (!lake) { mount(content, emptyState({ icon: 'droplet', title: t('error.lakeNotFound') })); return; }
    titleEl.textContent = lake.name;
    const th = resolveThresholds(lake);
    const devs = st.devices.filter((d) => d.lakeId === lake.id);
    const a = aggregateLake(devs, st.telemetry, th);
    const assignable = st.devices.filter((d) => !d.lakeId);

    // Header: status + health gauge
    const header = mdCard([
      el('div', { class: 'row-between' }, [
        el('div', {}, [
          el('div', { class: 't-headline', text: lake.name }),
          el('div', { class: 't-body-sm muted', text: `${lake.district || ''} ${lake.region || ''}` }),
        ]),
        statusChip(lake.status === LAKE_STATUS.INACTIVE ? 'offline' : a.status,
          lake.status === LAKE_STATUS.INACTIVE ? t('lake.status_inactive') : t('tm.status_' + a.status)),
      ]),
      el('div', { style: 'display:flex;justify-content:center;margin-top:8px' }, [
        gauge({ value: a.healthScore, min: 0, max: 100, unit: t('tm.health'), color: healthColor(a.healthScore) }),
      ]),
      el('div', { class: 't-body-sm muted', style: 'text-align:center', text: `${a.online}/${a.deviceCount} ${t('tm.online')}` }),
    ], { elevated: true });

    // Sensor grid
    const sensors = el('div', { class: 'sensor-grid' }, [
      sensorCard({ label: 'DO', value: a.avgDo, unit: 'mg/L' }),
      sensorCard({ label: t('tm.temp'), value: a.avgTemp, unit: '°C' }),
      sensorCard({ label: 'pH', value: a.avgPh }),
      sensorCard({ label: t('tm.online'), value: `${a.online}/${a.deviceCount}` }),
    ]);

    // Devices
    const deviceRows = devs.length ? devs.map((d) => listItem({
      leading: 'chip', title: d.id,
      trailing: el('div', { class: 'row', style: 'gap:6px' }, [
        statusChip(deviceStatus(st.telemetry.get(d.id) || null, th), ''),
        mdButton({ label: t('lake.unassign'), variant: 'text', onClick: async (ev) => {
          ev.stopPropagation();
          try { await deviceAssignmentService.unassign(lake.id, d.id, s.uid); await dataStore.refresh(); toast(t('lake.unassigned'), 'ok'); }
          catch (e) { toast(t(handleError(e, 'unassign').messageKey), 'err'); }
        } }),
      ]),
      onClick: () => nav.push((n) => renderDeviceDetailPage(n, d.id)),
    })) : [el('div', { class: 't-body-sm muted', style: 'padding:8px 4px', text: t('lake.noDevices') })];

    const assignRow = [];
    if (assignable.length) {
      const sel = select([{ value: '', label: t('lake.selectDevice') }, ...assignable.map((d) => ({ value: d.id, label: d.id }))], '');
      const btn = mdButton({ label: t('lake.assign'), variant: 'tonal', onClick: async () => {
        if (!sel.value) return;
        try { await deviceAssignmentService.assign(lake.id, sel.value, s.uid); await dataStore.refresh(); toast(t('lake.assigned'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'assign').messageKey), 'err'); }
      } });
      assignRow.push(el('div', { class: 'row', style: 'gap:8px;margin-top:10px' }, [el('div', { class: 'grow' }, [sel]), btn]));
    }

    const devicesCard = mdCard([
      el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('lake.attachedDevices') }),
      el('div', { class: 'md-list' }, deviceRows),
      ...assignRow,
    ]);

    // Actions
    const archived = lake.status === LAKE_STATUS.ARCHIVED;
    const actions = [];
    if (!archived) {
      const toggle = lake.status === LAKE_STATUS.ACTIVE ? LAKE_STATUS.INACTIVE : LAKE_STATUS.ACTIVE;
      actions.push(mdButton({ label: t(lake.status === LAKE_STATUS.ACTIVE ? 'lake.deactivate' : 'lake.activate'), variant: 'outlined', full: true, onClick: async () => {
        try { await lakeService.setStatus(lake.id, toggle, s.uid); await dataStore.refresh(); toast(t('common.saved'), 'ok'); }
        catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
      } }));
      actions.push(mdButton({ label: t('lake.archive'), variant: 'text', full: true, onClick: () => {
        openDialog({ title: t('lake.archive') + '?', body: t('lake.archiveConfirm'), actions: [
          { label: t('common.cancel'), variant: 'text' },
          { label: t('lake.archive'), variant: 'text', onClick: async () => {
            try { await lakeService.archive(lake.id, s.uid); await dataStore.refresh(); toast(t('lake.archived'), 'ok'); nav.back(); }
            catch (e) { toast(t(handleError(e, 'archive').messageKey), 'err'); }
          } },
        ] });
      } }));
    }

    mount(content, el('div', { class: 'stack' }, [header, sensors, devicesCard, ...actions]));
  }

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = unsub;
  return root;
}

export default renderLakeDetailPage;
