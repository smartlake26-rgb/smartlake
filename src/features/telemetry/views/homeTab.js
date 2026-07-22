// ============================================================
//  features/telemetry/views/homeTab.js — Bosh sahifa (Dashboard) v2
//  AppBar (salom) + Quick Stats + Lake Cards (realtime).
//
//  DS-2 REDESIGN (Design System v2 ustida):
//   • Bento katakchalari yagona builder'da — DO/Temp/pH ranglari
//     chart palitrasi bilan bir xil (--chart-do/temp/ph): bosh
//     sahifa va grafiklar endi bitta rang tilida gaplashadi.
//   • Sensor qiymatlari .t-num-md (tabular-nums) — yangilanishda
//     "titramaydi".
//   • Emoji nuqtalar (🔴🟢🟡) CSS status-nuqtalarga almashtirildi —
//     har platformada bir xil, professional ko'rinish.
//   • Kartalar ketma-ket paydo bo'ladi (stagger animatsiya).
//   Funksionallik 100% saqlangan: dataStore, ob-havo, agregatsiya,
//   navigatsiya, i18n, cleanup — o'zgarmagan.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import {
  appBar, mdIconButton, statCard, mdCard, statusChip, skeletonCards, emptyState, openDialog,
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

/** Qurilma holati -> status rangi (emoji o'rniga CSS nuqta uchun). */
function devDotColor(devSt) {
  if (devSt === 'healthy' || devSt === 'good') return 'var(--md-success)';
  if (devSt === 'warning') return 'var(--md-warning)';
  return 'var(--md-critical)';
}

/** Bitta bento katakchasi — DO/Temp/pH/Health uchun yagona qurilish. */
function bentoCell({ ic, label, value, unit, color, critical = false }) {
  return el('div', {
    class: `bento-cell${critical ? ' bento-cell-critical' : ''}`,
    style: `background:color-mix(in srgb, ${color} 7%, var(--md-surface-container-lowest));`
      + `padding:12px 14px;border-radius:var(--shape-md);`
      + `border:1px solid ${critical ? 'var(--md-critical)' : 'color-mix(in srgb, ' + color + ' 16%, var(--md-outline-variant))'};`
      + 'display:flex;flex-direction:column;justify-content:space-between;min-height:80px',
  }, [
    el('div', { style: 'font-size:var(--fs-caption);color:var(--md-on-surface-variant);font-weight:650;letter-spacing:.04em;text-transform:uppercase;display:flex;align-items:center;gap:5px' }, [
      el('span', { html: icon(ic, 14), style: `color:${color};display:inline-flex` }),
      el('span', { text: label }),
    ]),
    el('div', { class: 't-num-md', style: `color:${color};margin-top:6px;display:flex;align-items:baseline;gap:3px` }, [
      el('span', { text: value ?? '—' }),
      unit ? el('span', { style: 'font-size:11px;font-weight:550;color:var(--md-on-surface-variant);letter-spacing:0', text: unit }) : null,
    ]),
  ]);
}

export function renderHomeTab(nav) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({
      title: `${t('home.hi')}, ${s.profile ? s.profile.ism : ''}`,
      subtitle: t('role.' + (s.role || 'farmer')),
      leading: s.profile && s.profile.photoUrl
        ? el('img', { src: s.profile.photoUrl, alt: '', class: 'md-avatar', style: 'object-fit:cover;border:1px solid color-mix(in srgb, var(--md-primary) 18%, transparent)' })
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

  // DS-E: har ko'l bo'yicha Online/Offline/Ogohlantirish tahlili
  function lakeStatusLists(st) {
    const onlineLakes = [], offlineLakes = [], alerts = [];
    st.lakes.forEach((lk) => {
      const th = resolveThresholds(lk);
      const devs = st.devices.filter((d) => d.lakeId === lk.id);
      const a = aggregateLake(devs, st.telemetry, th);
      const lastTs = a.lastUpdate ?? null;
      const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');
      (anyOnline ? onlineLakes : offlineLakes).push({ lake: lk, lastTs });

      // Ogohlantirish sabablari (aniq parametr bo'yicha)
      const msgs = [];
      if (a.avgDo != null && a.avgDo < th.do.crit) msgs.push(`DO KRITIK: ${a.avgDo} mg/L (< ${th.do.crit})`);
      else if (a.avgDo != null && a.avgDo < th.do.warn) msgs.push(`DO past: ${a.avgDo} mg/L (< ${th.do.warn})`);
      if (a.avgTemp != null && (a.avgTemp < th.temp.warnMin || a.avgTemp > th.temp.warnMax)) msgs.push(`Harorat: ${a.avgTemp}°C (${th.temp.warnMin}–${th.temp.warnMax} tashqarisida)`);
      if (a.avgPh != null && (a.avgPh < th.ph.warnMin || a.avgPh > th.ph.warnMax)) msgs.push(`pH: ${a.avgPh} (${th.ph.warnMin}–${th.ph.warnMax} tashqarisida)`);
      if (devs.length && !anyOnline) msgs.push("Barcha qurilmalar oflayn");
      if (a.hasAlarm || msgs.length) alerts.push({ lake: lk, ts: lastTs, msgs: msgs.length ? msgs : ['Ogohlantirish holati'] });
    });
    return { onlineLakes, offlineLakes, alerts };
  }

  // Dialog ichidagi ko'l qatori (bosilsa ko'lga o'tadi)
  function lakeRow({ lake, lastTs, sub }) {
    const row = el('div', { class: 'md-listitem tap', style: 'padding:11px 6px' }, [
      el('div', { class: 'grow' }, [
        el('div', { style: 'font-weight:700;font-size:13.5px', text: lake.name }),
        sub ? el('div', { class: 't-caption', style: 'margin-top:2px;line-height:1.45', html: sub }) : null,
      ]),
      el('div', { class: 't-caption', style: 'text-align:right;flex:none', text: fmtAge(lastTs) }),
    ]);
    row.addEventListener('click', () => {
      document.querySelectorAll('.md-scrim').forEach((x) => x.remove());
      nav.push((n) => renderLakeDetailPage(n, lake.id));
    });
    return row;
  }
  function openListDialog(title, items, emptyText) {
    openDialog({
      title,
      body: el('div', { class: 'md-list', style: 'max-height:55vh;overflow-y:auto' },
        items.length ? items : [el('div', { class: 't-body-sm muted', style: 'padding:12px 0', text: emptyText })]),
      actions: [{ label: 'Yopish', variant: 'text' }],
    });
  }

  function stats(st) {
    const { onlineLakes, offlineLakes, alerts } = lakeStatusLists(st);
    const onlineDev = st.devices.filter((d) => d.lakeId && presence((st.telemetry.get(d.id) || {}).ts) === 'online').length;

    const cLakes = statCard({ icon: 'droplet', value: st.lakes.length, label: t('home.lakes'), color: 'var(--md-primary)' });
    const cDevs = statCard({ icon: 'chip', value: st.devices.length, label: t('home.devices'), color: 'var(--md-tertiary)' });
    const cOnline = statCard({ icon: 'wifi', value: onlineLakes.length, label: t('home.online'), color: 'var(--md-success)' });
    const cOffline = statCard({ icon: 'power', value: offlineLakes.length, label: 'Offline', color: offlineLakes.length ? 'var(--md-critical)' : 'var(--md-neutral)' });

    // DS-E: kartalar BOSILADIGAN — ro'yxat oynalari
    cLakes.classList.add('tap'); cLakes.style.cursor = 'pointer';
    cLakes.addEventListener('click', () => nav.switchTab('lakes'));
    cDevs.classList.add('tap'); cDevs.style.cursor = 'pointer';
    cDevs.addEventListener('click', () => nav.switchTab('devices'));
    cOnline.style.cursor = 'pointer';
    cOnline.addEventListener('click', () => openListDialog(
      `${t('home.online')} — ${onlineLakes.length}`,
      onlineLakes.map((x) => lakeRow(x)),
      "Onlayn ko'l yo'q"));
    cOffline.style.cursor = 'pointer';
    cOffline.addEventListener('click', () => openListDialog(
      `Offline — ${offlineLakes.length}`,
      offlineLakes.map((x) => lakeRow(x)),
      "Barcha ko'llar onlayn ✓"));

    // Ogohlantirish — keng karta: qaysi ko'l / qachon / nima
    const alertBar = el('div', {
      class: 'md-stat', style: `grid-column:1/-1;cursor:pointer;display:flex;align-items:center;gap:12px;`
        + (alerts.length ? 'border-color:color-mix(in srgb, var(--md-critical) 35%, var(--md-outline-variant))' : ''),
    }, [
      el('div', { class: 's-ic', style: `margin-bottom:0;background:${alerts.length ? 'var(--md-critical-soft)' : 'var(--md-neutral-soft)'};color:${alerts.length ? 'var(--md-critical)' : 'var(--md-neutral)'}`, html: icon('bell', 20) }),
      el('div', { class: 'grow' }, [
        el('div', { class: 's-val', style: `font-size:20px;color:${alerts.length ? 'var(--md-critical)' : 'var(--md-on-surface)'}`, text: String(alerts.length) }),
        el('div', { class: 's-lab', style: 'margin-top:2px', text: t('home.alerts') + (alerts.length ? ` — ${alerts[0].lake.name}${alerts.length > 1 ? ` +${alerts.length - 1}` : ''}` : '') }),
      ]),
      el('span', { html: icon('chevronRight', 18), style: 'color:var(--md-on-surface-variant);display:inline-flex' }),
    ]);
    alertBar.addEventListener('click', () => openListDialog(
      `${t('home.alerts')} — ${alerts.length}`,
      alerts.map((x) => lakeRow({ lake: x.lake, lastTs: x.ts,
        sub: x.msgs.map((m) => `<span style="color:var(--md-critical);font-weight:600">• ${m}</span>`).join('<br>') })),
      "Ogohlantirish yo'q ✓"));

    const grid = el('div', { class: 'md-stats', style: 'margin-bottom:var(--section-gap)' }, [
      cLakes, cDevs, cOnline, cOffline, alertBar,
    ]);
    return grid;
  }

  function lakeCard(lk, st, index = 0) {
    const th = resolveThresholds(lk);
    const devs = st.devices.filter((d) => d.lakeId === lk.id);
    const a = aggregateLake(devs, st.telemetry, th);

    // Ob-havo yuklash (avvalgidek)
    loadLakeWeather(lk);
    const w = weatherMap.get(lk.id);

    // Bento: sensor ranglari chart palitrasi bilan BIR XIL —
    // DO=teal, Temp=apelsin, pH=binafsha (grafikda ham shu ranglar).
    const bentoGrid = el('div', {
      style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:12px;margin-bottom:8px',
    }, [
      bentoCell({ ic: 'waves',       label: 'DO',           value: a.avgDo,   unit: 'mg/L', color: 'var(--chart-do)' }),
      bentoCell({ ic: 'thermometer', label: t('tm.temp'),   value: a.avgTemp, unit: '°C',   color: 'var(--chart-temp)' }),
      bentoCell({ ic: 'activity',    label: 'pH',           value: a.avgPh,   unit: '',     color: 'var(--chart-ph)' }),
      bentoCell({ ic: 'sun',         label: t('tm.health'), value: `${a.healthScore}%`, unit: '',
                  color: healthColor(a.healthScore), critical: a.healthScore <= 60 }),
    ]);

    // Ob-havo qatori (funksiya avvalgidek, ko'rinish tokenlarda)
    let weatherRow = null;
    if (w) {
      const isUz = detectLocale() === 'uz';
      const weatherIconName = getWeatherIcon(w.code);
      weatherRow = el('div', {
        style: 'margin-top:8px;margin-bottom:4px;padding:9px 13px;border-radius:var(--shape-sm);'
          + 'background:color-mix(in srgb, var(--md-tertiary) 7%, var(--md-surface-container-lowest));'
          + 'border:1px solid color-mix(in srgb, var(--md-tertiary) 16%, var(--md-outline-variant));'
          + 'display:flex;align-items:center;justify-content:space-between;'
          + 'font-size:var(--fs-body-sm);font-weight:550;color:var(--md-on-surface-variant)',
      }, [
        el('div', { style: 'display:flex;align-items:center;gap:7px;min-width:0' }, [
          el('span', { html: icon(weatherIconName, 16), style: 'color:var(--md-tertiary);display:inline-flex;flex:none' }),
          el('span', { style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: `${w.district}: ${w.temp}°C (${w.label})` }),
        ]),
        el('span', {
          style: 'font-size:var(--fs-caption);font-weight:700;flex:none;font-variant-numeric:tabular-nums',
          text: isUz ? `Ertaga: ${w.tomorrowTempMax}°C` : `Завтра: ${w.tomorrowTempMax}°C`,
        }),
      ]);
    }

    // Qurilmalar bo'linmasi — emoji o'rniga CSS status-nuqtalar
    let devicesBreakdown = null;
    if (devs.length >= 1) {
      devicesBreakdown = el('div', {
        style: 'margin-top:12px;padding-top:12px;border-top:1px dashed var(--md-outline-variant);display:flex;flex-direction:column;gap:8px',
      }, [
        el('div', { class: 't-label', style: 'color:var(--md-primary)', text: 'Qurilmalar holati' }),
        el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px' }, devs.map((d) => {
          const tel = st.telemetry.get(d.id);
          const pres = tel ? presence(tel.ts) : 'offline';
          const isOnline = pres === 'online';
          const devSt = isOnline ? deviceStatus(tel, th) : 'offline';
          const dotColor = isOnline ? devDotColor(devSt) : 'var(--md-neutral)';

          return el('div', {
            style: 'padding:9px 11px;border-radius:var(--shape-sm);background:var(--md-surface-container-lowest);'
              + 'border:1px solid var(--md-outline-variant);display:flex;flex-direction:column;gap:4px;min-width:0',
          }, [
            el('div', { style: 'display:flex;align-items:center;gap:6px;min-width:0' }, [
              el('span', { style: `width:8px;height:8px;border-radius:50%;flex:none;background:${dotColor};`
                + (isOnline ? `box-shadow:0 0 5px ${dotColor}` : '') }),
              el('span', { style: 'font-size:11.5px;font-weight:700;color:var(--md-on-surface);overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
                text: `Qurilma ${d.id.slice(-4)} (${d.region || 'Asosiy'})` }),
            ]),
            el('span', { class: 't-mono', style: 'font-size:11px;color:var(--md-on-surface-variant);font-weight:600;font-variant-numeric:tabular-nums',
              text: isOnline ? `DO ${tel.do ?? '—'} | ${tel.t ?? '—'}°C` : 'Oflayn' }),
          ]);
        })),
      ]);
    }

    const card = mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title', text: lk.name }),
        statusChip(a.status, t('tm.status_' + a.status)),
      ]),
      el('div', { class: 't-body-sm muted', style: 'margin-top:3px', text:
        `${a.deviceCount} ${t('lake.devices')} · ${a.online}/${a.offline} ${t('tm.online')}` }),
      bentoGrid,
      weatherRow,
      devicesBreakdown,
      el('div', { style: 'margin-top:12px;display:flex;align-items:center;gap:5px;font-size:var(--fs-caption);color:var(--md-on-surface-variant)' }, [
        el('span', { html: icon('info', 12), style: 'display:inline-flex;opacity:.7' }),
        el('span', { text: `${t('tm.lastUpdate')}: ${fmtAge(a.lastUpdate)}` }),
      ]),
    ], {
      elevated: true, cls: 'anim-up',
      onClick: () => nav.push((n) => renderLakeDetailPage(n, lk.id)),
    });

    // Stagger: kartalar ketma-ket paydo bo'ladi (reduced-motion'da avtomatik o'chadi)
    card.style.animationDelay = `${Math.min(index * 60, 240)}ms`;
    card.style.animationFillMode = 'both';
    return card;
  }

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.lakes.length) {
      mount(content, emptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint') }));
      return;
    }
    mount(content, stats(st), el('div', { class: 'stack' }, st.lakes.map((lk, i) => lakeCard(lk, st, i))));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderHomeTab;
