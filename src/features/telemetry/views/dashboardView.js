// ============================================================
//  features/telemetry/views/dashboardView.js — Fermer Dashboard
//  lakes + devices (bir marta) + telemetriya (realtime) birlashadi.
//  Har Lake Card: nom, qurilma soni, online/offline, avg DO/temp/pH,
//  oxirgi yangilanish, Health Score, alarm indikatori.
//  Listener root.__cleanup orqali yopiladi (router chaqiradi).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { lakeService } from '../../lakes/index.js';
import { deviceService } from '../../devices/index.js';
import { authStore } from '../../auth/index.js';
import { telemetryService } from '../services/telemetryService.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { aggregateLake } from '../domain/aggregate.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { statusBadge } from '../components/statusBadge.js';
import { skeletonCards } from '../components/skeleton.js';
import { offlineBanner } from '../components/offlineBanner.js';
import { emptyState } from '../components/emptyState.js';

function fmtAge(ts) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return t('tm.justNow');
  if (m < 60) return `${m} ${t('tm.minAgo')}`;
  const h = Math.floor(m / 60);
  return `${h} ${t('tm.hourAgo')}`;
}
function metric(labelKey, value, unit = '') {
  return el('div', { class: 'metric' }, [
    el('div', { class: 'm-label', text: t(labelKey) }),
    el('div', { class: 'm-value', text: value == null ? '—' : `${value}${unit}` }),
  ]);
}
function healthColor(score) {
  if (score >= 90) return 'var(--ok)';
  if (score >= 60) return 'var(--warn)';
  return 'var(--crit)';
}

export function renderDashboard(ctx = {}) {
  const s = authStore.getState();
  const bannerSlot = el('div', {});
  const body = el('div', {});
  const goBack = () => { if (ctx.onBack) ctx.onBack(); };
  const root = el('div', { class: 'app' }, [
    el('div', { class: 'topbar with-back' }, [
      el('button', { class: 'topbar-back', html: icon('arrowLeft', 22), onClick: goBack }),
      el('span', { text: t('tm.dashboard') }),
    ]),
    el('div', { class: 'auth-wrap' }, [
      bannerSlot,
      body,
      el('button', { class: 'btn ghost', text: t('common.back'), onClick: goBack }),
    ]),
  ]);

  let lakes = [];
  let devices = [];
  let telemetry = new Map();
  let unsub = null;
  let destroyed = false;
  const onNet = () => renderAll();

  mount(body, skeletonCards(3));

  function deviceRow(d) {
    const tel = telemetry.get(d.id) || null;
    const th = resolveThresholds(null);
    return el('div', {
      class: 'set-row', style: 'cursor:pointer',
      onClick: () => ctx.onOpenDevice && ctx.onOpenDevice(d.id),
    }, [
      el('span', { style: 'font-family:var(--mono);font-size:13px', text: d.id }),
      statusBadge(deviceStatus(tel, th)),
    ]);
  }

  function lakeCard(lake) {
    const th = resolveThresholds(lake);
    const lakeDevices = devices.filter((d) => d.lakeId === lake.id);
    const a = aggregateLake(lakeDevices, telemetry, th);
    const head = el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
      el('div', { style: 'font-weight:700;font-size:16px' }, [
        el('span', { text: lake.name }),
        ...(a.hasAlarm ? [el('span', { class: 'alarm-dot', title: t('tm.alarm') })] : []),
      ]),
      statusBadge(a.status),
    ]);
    const counts = el('div', { style: 'font-size:12px;color:var(--ink-soft);margin-top:2px', text:
      `${a.deviceCount} ${t('lake.devices')} · ${a.online} ${t('tm.online')} / ${a.offline} ${t('tm.offline')}` });
    const metrics = el('div', { class: 'metrics' }, [
      metric('tm.avgDo', a.avgDo, ''),
      metric('tm.avgTemp', a.avgTemp, '°'),
      metric('tm.avgPh', a.avgPh, ''),
    ]);
    const health = el('div', {}, [
      el('div', { style: 'display:flex;justify-content:space-between;font-size:12px;margin-top:10px' }, [
        el('span', { text: t('tm.health') }),
        el('span', { style: 'font-weight:700', text: `${a.healthScore}/100` }),
      ]),
      el('div', { class: 'health-bar' }, [el('div', { class: 'health-fill', style: `width:${a.healthScore}%;background:${healthColor(a.healthScore)}` })]),
    ]);
    const last = el('div', { style: 'font-size:12px;color:var(--ink-soft);margin-top:8px', text: `${t('tm.lastUpdate')}: ${fmtAge(a.lastUpdate)}` });
    const devs = lakeDevices.length
      ? el('div', { style: 'margin-top:8px' }, lakeDevices.map(deviceRow))
      : el('div', { style: 'font-size:12px;color:var(--ink-soft);margin-top:8px', text: t('lake.noDevices') });

    return el('div', { class: 'card', style: 'margin-bottom:12px' }, [head, counts, metrics, health, last, devs]);
  }

  function renderAll() {
    mount(bannerSlot, navigator.onLine === false ? offlineBanner() : el('span'));
    if (!lakes.length) { mount(body, emptyState('tm.empty')); return; }
    mount(body, ...lakes.map(lakeCard));
  }

  async function boot() {
    try {
      [lakes, devices] = await Promise.all([
        lakeService.listByOwner(s.uid),
        deviceService.listByOwner(s.uid),
      ]);
    } catch (e) {
      mount(body, el('div', { class: 'banner err', text: t(handleError(e, 'dashboard.load').messageKey) }));
      return;
    }
    if (destroyed) return;                       // ekran yopilgan bo'lsa listener ochmaymiz
    unsub = telemetryService.watchByOwner(
      s.uid,
      ({ telemetry: map }) => { telemetry = map; renderAll(); },
      () => renderAll(),
    );
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    renderAll();
  }
  boot();

  root.__cleanup = () => {
    destroyed = true;
    if (unsub) unsub();
    window.removeEventListener('online', onNet);
    window.removeEventListener('offline', onNet);
  };
  return root;
}

export default renderDashboard;
