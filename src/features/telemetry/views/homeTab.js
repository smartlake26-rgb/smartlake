// ============================================================
//  features/telemetry/views/homeTab.js — Bosh sahifa (Dashboard)
//  AppBar (salom) + Quick Stats + Lake Cards (realtime).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import {
  appBar, mdIconButton, statCard, mdCard, statusChip, skeletonCards, emptyState,
} from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { aggregateLake } from '../domain/aggregate.js';
import { presence } from '../domain/freshness.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';
import { renderLakeDetailPage } from '../../lakes/views/lakeDetailPage.js';

function initials(profile) {
  if (!profile) return '·';
  return `${(profile.ism || '?')[0] || ''}${(profile.fam || '')[0] || ''}`.toUpperCase();
}
function healthColor(s) { return s >= 90 ? 'var(--md-success)' : s >= 60 ? 'var(--md-warning)' : 'var(--md-critical)'; }
function fmtAge(ts) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}

export function renderHomeTab(nav) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({
      title: `${t('home.hi')}, ${s.profile ? s.profile.ism : ''}`,
      subtitle: t('role.' + (s.role || 'farmer')),
      leading: el('div', { class: 'md-avatar', text: initials(s.profile) }),
      actions: [
        mdIconButton({ icon: 'bell', onClick: () => nav.switchTab('alerts') }),
        mdIconButton({ icon: 'settings', onClick: () => nav.switchTab('profile') }),
      ],
    }),
    content,
  ]);

  function stats(st) {
    const online = st.devices.filter((d) => d.lakeId && presence((st.telemetry.get(d.id) || {}).ts) === 'online').length;
    let alerts = 0;
    st.lakes.forEach((lk) => {
      const a = aggregateLake(st.devices.filter((d) => d.lakeId === lk.id), st.telemetry, resolveThresholds(lk));
      if (a.hasAlarm) alerts += 1;
    });
    return el('div', { class: 'md-stats', style: 'margin-bottom:16px' }, [
      statCard({ icon: 'droplet', value: st.lakes.length, label: t('home.lakes'), color: 'var(--md-primary)' }),
      statCard({ icon: 'chip', value: st.devices.length, label: t('home.devices'), color: 'var(--md-tertiary)' }),
      statCard({ icon: 'wifi', value: online, label: t('home.online'), color: 'var(--md-success)' }),
      statCard({ icon: 'bell', value: alerts, label: t('home.alerts'), color: alerts ? 'var(--md-critical)' : 'var(--md-neutral)' }),
    ]);
  }

  function lakeCard(lk, st) {
    const th = resolveThresholds(lk);
    const devs = st.devices.filter((d) => d.lakeId === lk.id);
    const a = aggregateLake(devs, st.telemetry, th);
    return mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title', text: lk.name }),
        statusChip(a.status, t('tm.status_' + a.status)),
      ]),
      el('div', { class: 't-body-sm muted', style: 'margin-top:2px', text:
        `${a.deviceCount} ${t('lake.devices')} · ${a.online}/${a.offline} ${t('tm.online')}` }),
      el('div', { class: 'sensor-grid', style: 'margin-top:12px' }, [
        el('div', { class: 'sensor-card' }, [el('div', { class: 'sc-lab', text: 'DO' }), el('div', { class: 'sc-val', html: `${a.avgDo ?? '—'}` })]),
        el('div', { class: 'sensor-card' }, [el('div', { class: 'sc-lab', text: t('tm.temp') }), el('div', { class: 'sc-val', html: `${a.avgTemp ?? '—'}<span class="sc-unit">°</span>` })]),
      ]),
      el('div', { class: 'row-between', style: 'margin-top:12px' }, [
        el('span', { class: 't-body-sm muted', text: `${t('tm.health')}` }),
        el('span', { class: 't-title-sm', text: `${a.healthScore}/100` }),
      ]),
      el('div', { class: 'health-track' }, [el('div', { class: 'health-fill', style: `width:${a.healthScore}%;background:${healthColor(a.healthScore)}` })]),
      el('div', { class: 't-body-sm muted', style: 'margin-top:10px', text: `${t('tm.lastUpdate')}: ${fmtAge(a.lastUpdate)}` }),
    ], { elevated: true, cls: 'anim-up', onClick: () => nav.push((n) => renderLakeDetailPage(n, lk.id)) });
  }

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.lakes.length) {
      mount(content, emptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint') }));
      return;
    }
    mount(content, stats(st), el('div', { class: 'stack' }, st.lakes.map((lk) => lakeCard(lk, st))));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderHomeTab;
