// ============================================================
//  features/telemetry/views/homeTab.js — BOSH SAHIFA v4
//  SODDALASHTIRILGAN "tezkor boshqaruv paneli" (DASH-V4)
//
//  Tuzilishi: Header (salom + sana/vaqt | qo'ng'iroq + tema) ->
//  4 stat karta (Aktiv qurilmalar / Onlayn / Oflayn / Ogohlantirish)
//  -> Ko'llar ro'yxati (slLakeMonitorCard: rasm-cover, nom, onlayn,
//  salomatlik, yangilanish, ob-havo qatori, BUGUNGI YEM REJASI
//  "08:00 — 18 kg" ko'rinishida) -> So'nggi ogohlantirishlar ->
//  E'lonlar (oxirgisi, ANN-V1 xizmatidan).
//
//  OLIB TASHLANGAN (DASH-V4 topshirig'i bo'yicha): Tizim salomatligi
//  hero (bitta qurilmani "tizim" deb chalg'itardi), AI kartasi (AI
//  endi faqat har ko'l ichida individual — lakeDetailPage AI tabi),
//  Elektr kartasi (Hisobot bo'limiga tegishli — u yerda to'liq bor),
//  alohida katta Ob-havo kartasi (ko'l kartasi ichidagisi yetarli).
//
//  SAQLANGAN funksiyalar: onlayn/oflayn ro'yxat dialoglari (signal
//  sifati bilan), ogohlantirish tafsilotlari dialogi + sahifasi,
//  ko'l sahifasiga o'tish, har-ko'l ob-havosi, qurilmalar sahifasi
//  (Aktiv qurilmalar kartasi orqali), i18n, dataStore + cleanup.
//  Business logic O'ZGARMAGAN — aggregateLake, presence,
//  rssiQuality, computeFeedPlan, getLakeWeather.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { openDialog } from '../../../shared/ui/index.js';
import { toggleTheme, getTheme } from '../../../shared/ui/theme.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { aggregateLake } from '../domain/aggregate.js';
import { presence } from '../domain/freshness.js';
import { rssiQuality } from '../domain/signalQuality.js';
import { computeFeedPlan } from '../domain/feedEngine.js';
import { loadLakeMeta } from '../services/archiveService.js';
import { getLakeWeather, getWeatherIcon } from '../services/weatherService.js';
import { renderLakeDetailPage } from '../../lakes/views/lakeDetailPage.js';
import { fetchAnnouncements } from '../../announcements/announcementsService.js';
import { announcementCard } from '../../announcements/views/announcementsTab.js';
import {
  slIcon, ICONS, slIconButton, slCard, slStatCard, slLakeMonitorCard,
  slWeatherCard, slEmptyState, slBadge, slButton, slCountUp,
} from '../../../design-system/index.js';

/* ---------- modul keshlari ---------- */
const WEATHER_TTL = 15 * 60 * 1000;
const weatherCache = new Map();   // lakeId -> { data, at, loading }
const metaCache = new Map();      // lakeId -> lakeMeta | null

/* ---------- formatlagichlar ---------- */
function fmtAge(ts) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}
function fmtClock(d) { const p = (n) => String(n).padStart(2, '0'); return `${p(d.getHours())}:${p(d.getMinutes())}`; }
function fmtDate(d, isUz) {
  const daysUz = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const daysRu = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const monUz = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const monRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${(isUz ? daysUz : daysRu)[d.getDay()]}, ${d.getDate()}-${(isUz ? monUz : monRu)[d.getMonth()]}`;
}
function greetKey(h) { return h < 11 ? 'dash.morning' : h < 18 ? 'dash.day' : 'dash.evening'; }
function gradeOf(score) {
  if (score >= 90) return { key: 'dash.gradeA', colorVar: '--sl-success' };
  if (score >= 75) return { key: 'dash.gradeB', colorVar: '--sl-success' };
  if (score >= 60) return { key: 'dash.gradeC', colorVar: '--sl-warning' };
  return { key: 'dash.gradeD', colorVar: '--sl-critical' };
}
const SEV = { critical: 0, warning: 1, offline: 2, unknown: 3, good: 4, healthy: 5 };

export function renderHomeTab(nav) {
  const s = authStore.getState();
  const isUz = detectLocale() === 'uz';
  const content = el('div', { class: 'md-content' });
  let firstRender = true;
  let lastSig = '';
  const timers = [];
  let annPreview;   // e'lon preview (lazy, bir marta)

  /* --------- HEADER (o'zgarmagan) --------- */
  const clockEl = el('div', { class: 'sl-caption', style: 'margin-top:2px' });
  const greetEl = el('div', { class: 'sl-title' });
  const bellDot = el('span', { class: 'sl-dot-badge', style: 'position:absolute;top:8px;right:9px;display:none' });
  const bellBtn = slIconButton({ icon: ICONS.alert.bell, label: t('dash.alerts'),
    onClick: () => nav.switchTab('alerts') });
  bellBtn.style.position = 'relative';
  bellBtn.appendChild(bellDot);
  const themeBtn = slIconButton({ icon: getTheme() === 'dark' ? 'sun' : 'moon', label: t('menu.theme'),
    onClick: () => { const next = toggleTheme(); themeBtn.innerHTML = slIcon(next === 'dark' ? 'sun' : 'moon', 22); } });
  function tickClock() {
    const now = new Date();
    greetEl.textContent = `${t(greetKey(now.getHours()))}, ${s.profile ? s.profile.ism : ''}`;
    clockEl.textContent = `${fmtDate(now, isUz)} · ${fmtClock(now)}`;
  }
  tickClock();
  timers.push(setInterval(tickClock, 30_000));
  const header = el('div', { class: 'md-appbar' }, [el('div', { class: 'grow' }, [greetEl, clockEl]), bellBtn, themeBtn]);
  const node = el('div', {}, [header, content]);

  /* --------- SNAPSHOT (domen modullari) --------- */
  function computeSnapshot(st) {
    const perLake = st.lakes.map((lk) => {
      const th = resolveThresholds(lk);
      const devs = st.devices.filter((d) => d.lakeId === lk.id);
      const a = aggregateLake(devs, st.telemetry, th);
      const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');
      let bestRssi = null;
      devs.forEach((d) => { const tel = st.telemetry.get(d.id);
        if (tel && typeof tel.rssi === 'number') bestRssi = bestRssi == null ? tel.rssi : Math.max(bestRssi, tel.rssi); });
      const msgs = [];
      if (a.avgDo != null && a.avgDo < th.do.crit) msgs.push(`DO ${isUz ? 'KRITIK' : 'КРИТИЧНО'}: ${a.avgDo} mg/L (< ${th.do.crit})`);
      else if (a.avgDo != null && a.avgDo < th.do.warn) msgs.push(`DO ${isUz ? 'past' : 'низкий'}: ${a.avgDo} mg/L (< ${th.do.warn})`);
      if (a.avgTemp != null && (a.avgTemp < th.temp.warnMin || a.avgTemp > th.temp.warnMax)) msgs.push(`${t('tm.temp')}: ${a.avgTemp}°C (${th.temp.warnMin}–${th.temp.warnMax})`);
      if (a.avgPh != null && (a.avgPh < th.ph.warnMin || a.avgPh > th.ph.warnMax)) msgs.push(`pH: ${a.avgPh} (${th.ph.warnMin}–${th.ph.warnMax})`);
      if (devs.length && !anyOnline) msgs.push(isUz ? 'Barcha qurilmalar oflayn' : 'Все устройства офлайн');
      return { lake: lk, th, devs, a, anyOnline, bestRssi, msgs };
    });
    // Qurilma darajasidagi statlar (DASH-V4: "Aktiv qurilmalar")
    const assigned = st.devices.filter((d) => d.lakeId);
    const onlineDevs = assigned.filter((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online').length;
    return {
      perLake,
      alerts: perLake.filter((x) => x.a.hasAlarm || x.msgs.length),
      activeDevices: assigned.length,
      onlineDevs,
      offlineDevs: assigned.length - onlineDevs,
      onlineLakes: perLake.filter((x) => x.anyOnline),
      offlineLakes: perLake.filter((x) => !x.anyOnline),
    };
  }
  function signatureOf(st, snap) {
    return JSON.stringify([
      snap.activeDevices, snap.onlineDevs, snap.offlineDevs, snap.alerts.length,
      snap.perLake.map((x) => [x.lake.id, x.lake.name, x.a.status, x.a.healthScore,
        x.a.avgTemp, Math.floor((x.a.lastUpdate || 0) / 60000)]),
      [...metaCache.keys()].length,
      [...weatherCache.keys()].map((k) => (weatherCache.get(k).data || {}).temp),
    ]);
  }

  /* --------- DIALOGLAR (SAQLANGAN funksiyalar) --------- */
  function lakeRow({ lake, a, bestRssi, msgs }, { showSignal = false, showMsgs = false } = {}) {
    const subKids = [];
    if (showSignal) {
      const q = rssiQuality(bestRssi);
      subKids.push(el('span', { class: 'sl-caption',
        text: `${t('dash.signal')}: ${t('dash.signal_' + q)}${bestRssi != null ? ` (${bestRssi} dBm)` : ''}` }));
    }
    if (showMsgs && msgs.length) {
      subKids.push(el('span', { class: 'sl-caption', style: 'color:var(--sl-critical);font-weight:600',
        html: msgs.map((m) => `• ${m}`).join('<br>') }));
      subKids.push(el('span', {}, [slBadge({ type: 'warning', label: t('dash.unresolved'), dot: false })]));
    }
    const row = el('div', { class: 'sl-listitem interactive', role: 'button', tabindex: '0' }, [
      el('div', { class: 'sl-grow' }, [
        el('div', { class: 'sl-subtitle', text: lake.name }),
        subKids.length ? el('div', { class: 'sl-stack-sm', style: 'gap:2px;margin-top:2px' }, subKids) : null,
      ].filter(Boolean)),
      el('div', { class: 'sl-caption', style: 'text-align:right;flex:none' }, [
        el('div', { text: t('dash.lastContact') }),
        el('div', { class: 'sl-num-sm', style: 'font-size:12px', text: fmtAge(a.lastUpdate) }),
      ]),
    ]);
    const go = () => {
      document.querySelectorAll('.md-scrim').forEach((x) => x.remove());
      nav.push((n) => renderLakeDetailPage(n, lake.id));
    };
    row.addEventListener('click', go);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return row;
  }
  function openListDialog(title, items, emptyText, extraAction) {
    openDialog({
      title,
      body: el('div', { class: 'sl-stack-sm', style: 'max-height:55vh;overflow-y:auto;gap:0' },
        items.length ? items : [el('div', { class: 'sl-body-sm sl-text-secondary', style: 'padding:12px 0', text: emptyText })]),
      actions: [...(extraAction ? [extraAction] : []), { label: isUz ? 'Yopish' : 'Закрыть', variant: 'text' }],
    });
  }

  /* --------- 1 · 4 STAT KARTA --------- */
  function statsRow(snap) {
    return el('div', { class: 'sl-grid-2' }, [
      slStatCard({ icon: 'chip', value: snap.activeDevices, label: t('dash.activeDevices'),
        color: 'var(--sl-primary)', ariaLabel: t('dash.activeDevices'),
        onClick: () => nav.switchTab('devices') }),
      slStatCard({ icon: 'wifi', value: snap.onlineDevs, label: t('dash.onlineDevices'),
        color: 'var(--sl-online)', ariaLabel: t('dash.onlineDevices'),
        onClick: () => openListDialog(`${t('dash.onlineLakes')} — ${snap.onlineLakes.length}`,
          snap.onlineLakes.map((x) => lakeRow(x, { showSignal: true })), t('dash.noOnline')) }),
      slStatCard({ icon: 'power', value: snap.offlineDevs, label: t('dash.offlineDevices'),
        color: snap.offlineDevs ? 'var(--sl-critical)' : 'var(--sl-offline)',
        ariaLabel: t('dash.offlineDevices'),
        onClick: () => openListDialog(`${t('dash.offlineLakes')} — ${snap.offlineLakes.length}`,
          snap.offlineLakes.map((x) => lakeRow(x, { showSignal: true })), t('dash.allOnline')) }),
      slStatCard({ icon: 'bell', value: snap.alerts.length, label: t('dash.alerts'),
        color: snap.alerts.length ? 'var(--sl-critical)' : 'var(--sl-offline)',
        ariaLabel: t('dash.alerts'),
        onClick: () => openListDialog(`${t('dash.alerts')} — ${snap.alerts.length}`,
          snap.alerts.map((x) => lakeRow(x, { showMsgs: true })), t('dash.noAlerts'),
          { label: t('dash.openAlertsPage'), variant: 'text', onClick: () => nav.switchTab('alerts') }) }),
    ]);
  }

  /* --------- 2 · KO'LLAR (monitor karta + bugungi yem) --------- */
  function loadWeather(lk) {
    const c = weatherCache.get(lk.id);
    if (c && (c.loading || Date.now() - c.at < WEATHER_TTL)) return;
    weatherCache.set(lk.id, { ...(c || {}), loading: true, at: c ? c.at : 0 });
    getLakeWeather(lk, detectLocale())
      .then((data) => { weatherCache.set(lk.id, { data, at: Date.now() }); scheduleRender(); })
      .catch(() => { weatherCache.set(lk.id, { data: (c && c.data) || null, at: Date.now() }); });
  }
  function ensureMeta(lakeId) {
    if (metaCache.has(lakeId)) return;
    metaCache.set(lakeId, undefined);   // yuklanmoqda belgisi
    loadLakeMeta(lakeId)
      .then((m) => { metaCache.set(lakeId, m); scheduleRender(); })
      .catch(() => { metaCache.set(lakeId, null); });
  }

  /** Bugungi yem rejasi qatori: "08:00 — 18 kg" chiplar (ishchilar uchun ko'rsatma). */
  function feedExtra(x) {
    const m = metaCache.get(x.lake.id);
    if (m === undefined) return null;   // hali yuklanmoqda — jim
    const w = weatherCache.get(x.lake.id);
    const plan = m ? computeFeedPlan({ fish: m.fish || [], feed: m.feed || {},
      tempC: x.a.avgTemp, weather: w ? w.data : null }) : null;
    if (!plan) {
      return el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-3)', text: t('dash.feedNoData') });
    }
    return el('div', { style: 'margin-top:var(--sl-sp-3)' }, [
      el('div', { class: 'sl-label', style: 'color:var(--sl-chart-feed);margin-bottom:var(--sl-sp-1);display:flex;align-items:center;gap:5px' }, [
        el('span', { style: 'display:inline-flex', html: slIcon('feed', 13) }),
        el('span', { text: `${t('dash.todayFeed')} · ${plan.dailyKg.toFixed(1)} kg` }),
      ]),
      el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' },
        plan.meals.map((meal) => el('span', {
          class: 'sl-badge neutral', style: 'font-variant-numeric:tabular-nums',
          text: `${meal.time} — ${meal.kg.toFixed(1)} kg`,
        }))),
    ]);
  }
  function weatherExtra(x) {
    const w = weatherCache.get(x.lake.id);
    if (!w || !w.data) return null;
    return el('div', { style: 'margin-top:var(--sl-sp-3)' }, [slWeatherCard({
      icon: getWeatherIcon(w.data.code),
      text: `${w.data.district}: ${w.data.temp}°C (${w.data.label})`,
      next: `${t('dash.weatherTomorrow')}: ${w.data.tomorrowTempMax}°C`,
    })]);
  }

  function lakeSection(snap) {
    const sorted = snap.perLake.slice().sort((p, q) => (SEV[p.a.status] ?? 9) - (SEV[q.a.status] ?? 9));
    const cards = sorted.map((x, i) => {
      loadWeather(x.lake);
      ensureMeta(x.lake.id);
      const g = gradeOf(x.a.healthScore);
      const hasData = x.devs.length > 0;
      const kind = !x.anyOnline ? 'offline'
        : x.a.status === 'critical' ? 'critical'
        : x.a.status === 'warning' ? 'warning' : 'online';
      const card = slLakeMonitorCard({
        name: x.lake.name,
        statusKind: kind,
        statusLabel: t('tm.status_' + x.a.status),
        meta: `${x.a.online}/${x.a.deviceCount} ${t('tm.online')}`,
        health: hasData ? x.a.healthScore : null,
        gradeLabel: t(g.key), gradeColorVar: g.colorVar,
        cells: [],   // DASH-V4: sodda — sensor katakchalari ko'l sahifasida
        updatedText: `${t('lakespg.updated')}: ${fmtAge(x.a.lastUpdate)}`,
        signalText: x.bestRssi != null ? `${t('dash.signal')}: ${t('dash.signal_' + rssiQuality(x.bestRssi))}` : '',
        extra: [feedExtra(x), weatherExtra(x)].filter(Boolean),
        ariaLabel: x.lake.name,
        onClick: () => nav.push((n) => renderLakeDetailPage(n, x.lake.id)),
      });
      if (firstRender) {
        card.classList.add('sl-anim-up');
        card.style.animationDelay = `${Math.min(i * 60, 240)}ms`;
        card.style.animationFillMode = 'both';
      }
      return card;
    });
    return el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-row-between' }, [
        el('div', { class: 'sl-label', style: 'color:var(--sl-text-secondary)', text: t('dash.lakesTitle') }),
        el('button', { class: 'sl-btn text sm', type: 'button', text: t('dash.allLakes'),
          onClick: () => nav.switchTab('lakes') }),
      ]),
      ...cards,
    ]);
  }

  /* --------- 3 · SO'NGGI OGOHLANTIRISHLAR --------- */
  function recentAlertsSection(snap) {
    if (!snap.alerts.length) return null;   // sodda: tinch payt ko'rinmaydi
    return slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { style: 'color:var(--sl-critical);display:inline-flex', html: slIcon(ICONS.alert.bell, 18) }),
          el('span', { text: t('dash.recentAlerts') }),
        ]),
        slBadge({ type: 'critical', label: String(snap.alerts.length) }),
      ]),
      el('div', { class: 'sl-stack-sm', style: 'gap:0' },
        snap.alerts.slice(0, 3).map((x) => lakeRow(x, { showMsgs: true }))),
      snap.alerts.length > 3 ? el('div', { style: 'margin-top:var(--sl-sp-2)' }, [
        slButton({ label: t('dash.openAlertsPage'), variant: 'text', size: 'sm',
          onClick: () => nav.switchTab('alerts') }),
      ]) : null,
    ].filter(Boolean), { premium: true });
  }

  /* --------- 4 · E'LONLAR (oxirgisi, lazy) --------- */
  const annBox = el('div');
  function loadAnnPreview() {
    if (annPreview !== undefined) return;
    annPreview = null;
    fetchAnnouncements().then((items) => {
      if (!items || !items.length) { annBox.replaceChildren(); return; }
      annPreview = items[0];
      const card = announcementCard(annPreview, { compact: true, isUz });
      card.classList.add('interactive');
      card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0');
      const go = () => nav.switchTab('elonlar');
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      mount(annBox, el('div', { class: 'sl-stack' }, [
        el('div', { class: 'sl-row-between' }, [
          el('div', { class: 'sl-label', style: 'color:var(--sl-text-secondary)', text: t('ann.onDash') }),
          el('button', { class: 'sl-btn text sm', type: 'button', text: t('ann.seeAll'), onClick: go }),
        ]),
        card,
      ]));
    }).catch(() => {});
  }

  /* --------- RENDER ORKESTRI --------- */
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderContent(); });
  }
  function skeleton() {
    return el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-grid-2' }, Array.from({ length: 4 }, () =>
        el('div', { class: 'sl-skeleton card', style: 'height:84px;margin:0' }))),
      el('div', { class: 'sl-skeleton card', style: 'height:200px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:200px' }),
    ]);
  }
  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeleton()); lastSig = ''; return; }
    if (!st.lakes.length) {
      mount(content, slEmptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint') }));
      lastSig = '';
      return;
    }
    const snap = computeSnapshot(st);
    const sig = signatureOf(st, snap);
    if (sig === lastSig && !firstRender) return;   // PERF: o'zgarish yo'q
    lastSig = sig;

    bellDot.style.display = snap.alerts.length ? '' : 'none';
    loadAnnPreview();

    mount(content, el('div', { class: 'sl-stack' }, [
      statsRow(snap),
      lakeSection(snap),
      recentAlertsSection(snap),
      annBox,
    ].filter(Boolean)));
    firstRender = false;
  }

  const unsub = dataStore.subscribe(scheduleRender);
  renderContent();
  node.__cleanup = () => { unsub(); timers.forEach(clearInterval); };
  return node;
}

export default renderHomeTab;
