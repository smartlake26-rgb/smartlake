// ============================================================
//  features/telemetry/views/deviceDetailPage.js — Qurilma tafsilotlari
//  Realtime sensor gauge'lari + barcha maydonlar + history sparkline.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import {
  appBar, mdIconButton, mdCard, statusChip, sensorCard, listItem, skeletonCards, emptyState, mdButton,
} from '../../../shared/ui/index.js';
import { gauge, sparkline } from '../../../shared/ui/gauge.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { authStore } from '../../auth/index.js';
import { historyService, RANGES } from '../services/historyService.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { healthScore } from '../domain/healthScore.js';
import { telemetryAge } from '../domain/freshness.js';
import { renderCommandPanel } from '../../commands/index.js';

function fmtAge(ts) {
  const age = telemetryAge(ts);
  if (age == null) return '—';
  const m = Math.floor(age / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}

export function renderDeviceDetailPage(nav, deviceId) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content no-nav' });
  const titleEl = el('div', { class: 'ab-title t-mono', text: deviceId || '—' });
  const root = el('div', { class: 'md-app' }, [
    el('div', { class: 'md-appbar' }, [mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }), el('div', { class: 'grow' }, [titleEl])]),
    content,
  ]);

  if (!deviceId) { mount(content, emptyState({ icon: 'chip', title: t('error.deviceNotFound') })); return root; }

  const histOut = el('div', {});
  const cmdPanel = renderCommandPanel(deviceId, s.uid);   // bir marta (o'z listeneri bilan)

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    const device = st.devices.find((d) => d.id === deviceId);
    if (!device) { mount(content, emptyState({ icon: 'chip', title: t('error.deviceNotFound') })); return; }
    const lake = st.lakes.find((l) => l.id === device.lakeId);
    const th = resolveThresholds(lake);
    const tel = st.telemetry.get(deviceId) || null;
    const status = deviceStatus(tel, th);

    const header = mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title-sm muted', text: `${t('tm.health')}: ${healthScore(tel, th)}/100` }),
        statusChip(status, t('tm.status_' + status)),
      ]),
      el('div', { class: 'row', style: 'justify-content:space-around;margin-top:8px' }, [
        gauge({ value: tel ? tel.do : null, min: 0, max: 15, unit: 'DO', color: 'var(--md-primary)', size: 110 }),
        gauge({ value: tel ? tel.t : null, min: 0, max: 40, unit: '°C', color: 'var(--md-tertiary)', size: 110 }),
      ]),
    ], { elevated: true });

    const sensors = el('div', { class: 'sensor-grid' }, [
      sensorCard({ label: 'pH', value: tel ? tel.ph : null, status }),
      sensorCard({ label: t('tm.battery'), value: tel && tel.battery != null ? tel.battery : null, unit: '%' }),
      sensorCard({ label: t('tm.rssi'), value: tel && tel.rssi != null ? tel.rssi : null, unit: 'dBm' }),
      sensorCard({ label: t('tm.telemetryAge'), value: fmtAge(tel ? tel.ts : null) }),
    ]);

    const info = mdCard([
      el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('tm.deviceInfo') }),
      el('div', { class: 'md-list' }, [
        listItem({ leading: 'chip', title: device.firmwareVersion || '—', subtitle: t('tm.firmware') }),
        listItem({ leading: 'wifi', title: tel && tel.gwVersion ? tel.gwVersion : '—', subtitle: t('tm.gateway') }),
        listItem({ leading: 'location', title: device.region || '—', subtitle: t('tm.region') }),
        listItem({ leading: 'droplet', title: lake ? lake.name : t('device.unassigned'), subtitle: t('tm.lake') }),
      ]),
    ]);

    const histBtns = Object.keys(RANGES).map((rk) => mdButton({ label: rk, variant: 'outlined', onClick: async () => {
      mount(histOut, el('div', { class: 't-body-sm muted', style: 'text-align:center;padding:12px', text: t('app.loading') }));
      try {
        const points = await historyService.getHistory(deviceId, rk);
        if (!points.length) { mount(histOut, el('div', { class: 't-body-sm muted', style: 'text-align:center;padding:12px', text: `0 ${t('tm.points')} (${rk})` })); return; }
        mount(histOut, sparkline(points.map((p) => p.do).filter((x) => typeof x === 'number')), el('div', { class: 't-body-sm muted', style: 'text-align:center', text: `${points.length} ${t('tm.points')} · DO` }));
      } catch (e) { mount(histOut, el('div', { class: 't-body-sm muted', style: 'text-align:center', text: t(handleError(e, 'history').messageKey) })); }
    } }));
    const history = mdCard([
      el('div', { class: 't-title-sm', style: 'margin-bottom:8px', text: t('tm.history') }),
      el('div', { class: 'row', style: 'gap:8px' }, histBtns),
      histOut,
    ]);

    mount(content, el('div', { class: 'stack' }, [header, sensors, cmdPanel, info, history]));
  }

  const unsub = dataStore.subscribe(render);
  render();
  root.__cleanup = () => { unsub(); if (cmdPanel && typeof cmdPanel.__cleanup === 'function') cmdPanel.__cleanup(); };
  return root;
}

export default renderDeviceDetailPage;
