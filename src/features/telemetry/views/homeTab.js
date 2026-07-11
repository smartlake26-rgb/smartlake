// ============================================================
//  features/telemetry/views/homeTab.js — Bosh sahifa (Dashboard)
//  AppBar (salom) + Quick Stats + Lake Cards (realtime).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import {
  appBar, mdIconButton, statCard, mdCard, statusChip, skeletonCards, emptyState,
} from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { aggregateLake } from '../domain/aggregate.js';
import { presence } from '../domain/freshness.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';
import { renderLakeDetailPage } from '../../lakes/views/lakeDetailPage.js';
import { getLakeWeather, getWeatherIcon } from '../services/weatherService.js';

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
      leading: s.profile && s.profile.photoUrl 
        ? el('img', { src: s.profile.photoUrl, class: 'md-avatar', style: 'object-fit:cover;border:1px solid rgba(0,112,144,0.15)' })
        : el('div', { class: 'md-avatar', text: initials(s.profile) }),
      actions: [
        mdIconButton({ icon: 'bell', onClick: () => nav.switchTab('alerts') }),
        mdIconButton({ icon: 'settings', onClick: () => nav.switchTab('profile') }),
      ],
    }),
    content,
  ]);

  const weatherMap = new Map();
  const weatherLoading = new Set();

  function loadLakeWeather(lk) {
    if (weatherMap.has(lk.id) || weatherLoading.has(lk.id)) return;
    weatherLoading.add(lk.id);
    const locale = detectLocale();
    getLakeWeather(lk, locale)
      .then((data) => {
        weatherMap.set(lk.id, data);
        renderContent();
      })
      .catch(() => {
        weatherLoading.delete(lk.id);
      });
  }

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
    
    // Trigger loading weather
    loadLakeWeather(lk);
    const w = weatherMap.get(lk.id);

    const bentoGrid = el('div', { 
      style: 'display:grid;grid-template-columns:repeat(2, 1fr);gap:10px;margin-top:12px;margin-bottom:8px' 
    }, [
      // Oxygen (DO) cell
      el('div', { 
        class: 'bento-cell',
        style: 'background:color-mix(in srgb, var(--md-primary) 6%, var(--md-surface-container));padding:10px 12px;border-radius:12px;border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;justify-content:space-between;min-height:76px' 
      }, [
        el('div', { style: 'font-size:11px;color:var(--md-on-surface-variant);font-weight:600;display:flex;align-items:center;gap:4px' }, [
          el('span', { html: icon('waves', 14), style: 'color:var(--md-primary)' }),
          el('span', { text: 'DO' })
        ]),
        el('div', { style: 'font-size:18px;font-weight:800;color:var(--md-primary);margin-top:4px' }, [
          el('span', { text: a.avgDo ?? '—' }),
          el('span', { style: 'font-size:11px;font-weight:500;color:var(--md-on-surface-variant)', text: ' mg/L' })
        ])
      ]),
      // Temp cell
      el('div', { 
        class: 'bento-cell',
        style: 'background:color-mix(in srgb, var(--md-tertiary) 6%, var(--md-surface-container));padding:10px 12px;border-radius:12px;border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;justify-content:space-between;min-height:76px' 
      }, [
        el('div', { style: 'font-size:11px;color:var(--md-on-surface-variant);font-weight:600;display:flex;align-items:center;gap:4px' }, [
          el('span', { html: icon('thermometer', 14), style: 'color:var(--md-tertiary)' }),
          el('span', { text: t('tm.temp') })
        ]),
        el('div', { style: 'font-size:18px;font-weight:800;color:var(--md-tertiary);margin-top:4px' }, [
          el('span', { text: a.avgTemp ?? '—' }),
          el('span', { style: 'font-size:12px;font-weight:500;color:var(--md-on-surface-variant)', text: '°C' })
        ])
      ]),
      // pH cell
      el('div', { 
        class: 'bento-cell',
        style: 'background:color-mix(in srgb, var(--md-secondary) 6%, var(--md-surface-container));padding:10px 12px;border-radius:12px;border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;justify-content:space-between;min-height:76px' 
      }, [
        el('div', { style: 'font-size:11px;color:var(--md-on-surface-variant);font-weight:600;display:flex;align-items:center;gap:4px' }, [
          el('span', { html: icon('activity', 14), style: 'color:var(--md-secondary)' }),
          el('span', { text: 'pH' })
        ]),
        el('div', { style: 'font-size:18px;font-weight:800;color:var(--md-secondary);margin-top:4px' }, [
          el('span', { text: a.avgPh ?? '—' })
        ])
      ]),
      // Health Index cell
      el('div', { 
        class: `bento-cell${a.healthScore <= 60 ? ' bento-cell-critical' : ''}`,
        style: `background:color-mix(in srgb, ${healthColor(a.healthScore)} 6%, var(--md-surface-container));padding:10px 12px;border-radius:12px;border:1px solid ${a.healthScore <= 60 ? 'var(--md-critical)' : 'var(--md-outline-variant)'};display:flex;flex-direction:column;justify-content:space-between;min-height:76px` 
      }, [
        el('div', { style: 'font-size:11px;color:var(--md-on-surface-variant);font-weight:600;display:flex;align-items:center;gap:4px' }, [
          el('span', { html: icon('sun', 14), style: `color:${healthColor(a.healthScore)}` }),
          el('span', { text: t('tm.health') })
        ]),
        el('div', { style: `font-size:18px;font-weight:800;color:${healthColor(a.healthScore)};margin-top:4px` }, [
          el('span', { text: `${a.healthScore}%` })
        ])
      ])
    ]);

    // Beautiful horizontal weather summary row
    let weatherRow = null;
    if (w) {
      const isUz = detectLocale() === 'uz';
      const weatherIconName = getWeatherIcon(w.code);
      weatherRow = el('div', {
        style: 'margin-top:8px;margin-bottom:4px;padding:8px 12px;border-radius:10px;background:color-mix(in srgb, var(--md-primary) 6%, var(--md-surface-container-low));border:1px solid var(--md-outline-variant);display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;color:var(--md-on-surface-variant)'
      }, [
        el('div', { style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { html: icon(weatherIconName, 15), style: 'color:var(--md-primary);display:inline-flex' }),
          el('span', { text: `${w.district}: ${w.temp}°C (${w.label})` })
        ]),
        el('span', {
          style: 'font-size:11px;opacity:0.9;font-weight:700',
          text: isUz ? `Ertaga: ${w.tomorrowTempMax}°C` : `Завтра: ${w.tomorrowTempMax}°C`
        })
      ]);
    }

    let devicesBreakdown = null;
    if (devs.length >= 1) {
      devicesBreakdown = el('div', {
        style: 'margin-top:12px; padding-top:10px; border-top:1px dashed var(--md-outline-variant); display:flex; flex-direction:column; gap:6px'
      }, [
        el('div', { style: 'font-size:11px; font-weight:700; color:var(--md-primary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px', text: 'Qurilmalar holati' }),
        el('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px' }, devs.map((d) => {
          const tel = st.telemetry.get(d.id);
          const pres = tel ? presence(tel.ts) : 'offline';
          const isOnline = pres === 'online';
          const devSt = isOnline ? deviceStatus(tel, th) : 'offline';
          
          let dot = '🔴';
          if (isOnline) {
            if (devSt === 'healthy' || devSt === 'good') dot = '🟢';
            else if (devSt === 'warning') dot = '🟡';
            else dot = '🔴';
          }
          
          const label = `${dot} Qurilma ${d.id.slice(-4)} (${d.region || 'Asosiy'})`;
          const values = isOnline 
            ? `DO ${tel.do ?? '—'} | ${tel.t ?? '—'}°C` 
            : 'Oflayn';

          return el('div', { 
            style: 'padding:8px 10px; border-radius:10px; background:var(--md-surface-container-low); border:1px solid var(--md-outline-variant); display:flex; flex-direction:column; gap:3px' 
          }, [
            el('span', { style: 'font-size:11.5px; font-weight:700; color:var(--md-on-surface); text-overflow:ellipsis; overflow:hidden; white-space:nowrap', text: label }),
            el('span', { style: 'font-size:11px; color:var(--md-on-surface-variant); font-family:monospace; font-weight:600', text: values }),
          ]);
        }))
      ]);
    }

    return mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title', style: 'letter-spacing:-0.2px', text: lk.name }),
        statusChip(a.status, t('tm.status_' + a.status)),
      ]),
      el('div', { class: 't-body-sm muted', style: 'margin-top:2px', text:
        `${a.deviceCount} ${t('lake.devices')} · ${a.online}/${a.offline} ${t('tm.online')}` }),
      bentoGrid,
      weatherRow,
      devicesBreakdown,
      el('div', { class: 't-body-sm muted', style: 'margin-top:10px;font-size:11.5px', text: `${t('tm.lastUpdate')}: ${fmtAge(a.lastUpdate)}` }),
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
