// ============================================================
//  features/telemetry/views/homeTab.js — BOSH SAHIFA v3
//  "MISSION CONTROL" (DASH-V3, Design System 3.0 ustida)
//
//  Maqsad: fermer 3 soniyada xo'jalik holatini tushunadi.
//  Tartib: Header (salom+vaqt / qo'ng'iroq+tema) -> Tizim
//  salomatligi (hero) -> Online/Offline -> Ogohlantirishlar ->
//  AI tavsiyasi -> Ko'llar -> Bugungi yem -> Elektr -> Ob-havo.
//
//  SAQLANGAN funksiyalar (v2 dan): online/offline ro'yxat
//  dialoglari, ogohlantirish tafsilotlari, ko'l kartalari,
//  har-ko'l ob-havosi, qurilmalar bo'linmasi, ko'l sahifasiga
//  o'tish, i18n, dataStore obunasi + cleanup.
//
//  PERFORMANCE: (1) snapshot-imzo memo — o'zgarmagan emit'da
//  qayta render YO'Q; (2) ob-havo 15 daq TTL kesh; (3) lakeMeta
//  sessiya keshi; (4) elektr — lazy (talab bo'yicha, davr
//  bo'yicha alohida); (5) stagger animatsiya faqat birinchi
//  renderda; (6) raqamlar slCountUp bilan joyida yangilanadi.
//
//  Business logic O'ZGARMAGAN — barcha hisoblar mavjud domen
//  modullaridan: aggregateLake, presence, deviceStatus,
//  rssiQuality, generateSmartAdvice, computeFeedPlan,
//  aeratorRuntimeMs, fetchArchive, loadLakeMeta, getLakeWeather.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { openDialog } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { aggregateLake } from '../domain/aggregate.js';
import { presence } from '../domain/freshness.js';
import { deviceStatus } from '../domain/statusEngine.js';
import { rssiQuality } from '../domain/signalQuality.js';
import { generateSmartAdvice } from '../domain/predictiveAdvisor.js';
import { computeFeedPlan } from '../domain/feedEngine.js';
import {
  fetchArchive, aeratorRuntimeMs, loadLakeMeta,
} from '../services/archiveService.js';
import { getLakeWeather, getWeatherIcon } from '../services/weatherService.js';
import { renderLakeDetailPage } from '../../lakes/views/lakeDetailPage.js';
import {
  slIcon, ICONS, slIconButton, slCard, slStatCard,
  slLakeCard, slAiCard, slWeatherCard, slEmptyState, slKvRow,
  slBadge, slCountUp, slFeedSchedule, slLakeMonitorCard, slButton,
} from '../../../design-system/index.js';
import { fetchAnnouncements } from '../../announcements/announcementsService.js';
import { announcementCard } from '../../announcements/views/announcementsTab.js';

/* ------------------------------------------------------------
   Modul-darajali keshlar (tab qayta ochilganda ham ishlaydi)
   ------------------------------------------------------------ */
const WEATHER_TTL = 15 * 60 * 1000;
const weatherCache = new Map();   // lakeId -> { data, at }
const metaCache = new Map();      // lakeId -> lakeMeta | null
const energyCache = new Map();    // 'today'|'week'|'month' -> { at, hours, kwh, cost }
const ENERGY_TTL = 10 * 60 * 1000;

const DAY = 24 * 3600e3;

/* ---------- kichik formatlagichlar ---------- */
function fmtAge(ts) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}
function fmtClock(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(d, isUz) {
  const daysUz = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
  const daysRu = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const monUz = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  const monRu = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const days = isUz ? daysUz : daysRu; const mon = isUz ? monUz : monRu;
  return `${days[d.getDay()]}, ${d.getDate()}-${mon[d.getMonth()]}`;
}
function greetKey(h) { return h < 11 ? 'dash.morning' : h < 18 ? 'dash.day' : 'dash.evening'; }
function gradeOf(score) {
  if (score >= 90) return { key: 'dash.gradeA', colorVar: '--sl-success' };
  if (score >= 75) return { key: 'dash.gradeB', colorVar: '--sl-success' };
  if (score >= 60) return { key: 'dash.gradeC', colorVar: '--sl-warning' };
  return { key: 'dash.gradeD', colorVar: '--sl-critical' };
}
const SEV_ORDER = { critical: 0, warning: 1, offline: 2, unknown: 3, good: 4, healthy: 5 };

/* ============================================================
   ASOSIY RENDER
   ============================================================ */
export function renderHomeTab(nav) {
  const s = authStore.getState();
  const isUz = detectLocale() === 'uz';
  const uid = s.uid;

  const content = el('div', { class: 'md-content' });
  let firstRender = true;
  let lastSig = '';
  const timers = [];

  /* ----------------------------------------------------------
     HEADER — salom + sana/vaqt | qo'ng'iroq(+badge) + tema
     ---------------------------------------------------------- */
  const clockEl = el('div', { class: 'sl-caption', style: 'margin-top:2px' });
  const greetEl = el('div', { class: 'sl-title' });
  const bellDot = el('span', { class: 'sl-dot-badge',
    style: 'position:absolute;top:8px;right:9px;display:none' });
  const bellBtn = slIconButton({ icon: ICONS.alert.bell, label: t('dash.alerts'),
    onClick: () => nav.switchTab('alerts') });
  bellBtn.style.position = 'relative';
  bellBtn.appendChild(bellDot);
  const themeBtn = slIconButton({
    icon: getTheme() === 'dark' ? 'sun' : 'moon',
    label: t('menu.theme'),
    onClick: () => {
      const next = toggleTheme();
      themeBtn.innerHTML = slIcon(next === 'dark' ? 'sun' : 'moon', 22);
    },
  });
  function tickClock() {
    const now = new Date();
    greetEl.textContent = `${t(greetKey(now.getHours()))}, ${s.profile ? s.profile.ism : ''}`;
    clockEl.textContent = `${fmtDate(now, isUz)} · ${fmtClock(now)}`;
  }
  tickClock();
  timers.push(setInterval(tickClock, 30_000));

  // Header shell topbar'iga ko'chirildi — bu yerda faqat kontent
  const node = el('div', {}, [content]);

  /* ----------------------------------------------------------
     SNAPSHOT — barcha hisoblar bitta joyda (domen modullari)
     ---------------------------------------------------------- */
  function computeSnapshot(st) {
    const perLake = st.lakes.map((lk) => {
      const th = resolveThresholds(lk);
      const devs = st.devices.filter((d) => d.lakeId === lk.id);
      const a = aggregateLake(devs, st.telemetry, th);
      const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');
      // eng yaxshi signal (ro'yxat dialogi uchun)
      let bestRssi = null;
      devs.forEach((d) => {
        const tel = st.telemetry.get(d.id);
        if (tel && typeof tel.rssi === 'number') {
          bestRssi = bestRssi == null ? tel.rssi : Math.max(bestRssi, tel.rssi);
        }
      });
      // ogohlantirish sabablari (v2 mantig'i saqlangan)
      const msgs = [];
      if (a.avgDo != null && a.avgDo < th.do.crit) msgs.push(`DO ${isUz ? 'KRITIK' : 'КРИТИЧНО'}: ${a.avgDo} mg/L (< ${th.do.crit})`);
      else if (a.avgDo != null && a.avgDo < th.do.warn) msgs.push(`DO ${isUz ? 'past' : 'низкий'}: ${a.avgDo} mg/L (< ${th.do.warn})`);
      if (a.avgTemp != null && (a.avgTemp < th.temp.warnMin || a.avgTemp > th.temp.warnMax)) msgs.push(`${t('tm.temp')}: ${a.avgTemp}°C (${th.temp.warnMin}–${th.temp.warnMax})`);
      if (a.avgPh != null && (a.avgPh < th.ph.warnMin || a.avgPh > th.ph.warnMax)) msgs.push(`pH: ${a.avgPh} (${th.ph.warnMin}–${th.ph.warnMax})`);
      if (devs.length && !anyOnline) msgs.push(isUz ? 'Barcha qurilmalar oflayn' : 'Все устройства офлайн');
      return { lake: lk, th, devs, a, anyOnline, bestRssi, msgs };
    });

    const withDev = perLake.filter((x) => x.devs.length);
    const overall = withDev.length
      ? Math.round(withDev.reduce((sum, x) => sum + x.a.healthScore, 0) / withDev.length) : null;
    const alerts = perLake.filter((x) => x.a.hasAlarm || x.msgs.length);
    const assigned = st.devices.filter((d) => d.lakeId);
    const onlineDevs = assigned.filter((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online').length;
    return {
      perLake,
      overall,
      online: perLake.filter((x) => x.anyOnline),
      offline: perLake.filter((x) => !x.anyOnline),
      alerts,
      activeDevices: assigned.length,
      onlineDevs,
      offlineDevs: assigned.length - onlineDevs,
    };
  }

  /* Imzo: shu qiymatlar o'zgarmasa — DOM'ga tegilmaydi (perf). */
  function signatureOf(st, snap) {
    return JSON.stringify([
      snap.overall, snap.online.length, snap.offline.length, snap.alerts.length,
      snap.perLake.map((x) => [x.lake.id, x.lake.name, x.a.status, x.a.healthScore,
        x.a.avgDo, x.a.avgTemp, x.a.avgPh, x.a.online, x.a.offline,
        Math.floor((x.a.lastUpdate || 0) / 60000)]),
      st.lakes.length, st.devices.length, snap.onlineDevs,
      [...weatherCache.keys()].map((k) => (weatherCache.get(k).data || {}).temp),
    ]);
  }

  /* ----------------------------------------------------------
     DIALOGLAR (v2 funksiyalari saqlangan + boyitilgan)
     ---------------------------------------------------------- */
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
      actions: [
        ...(extraAction ? [extraAction] : []),
        { label: isUz ? 'Yopish' : 'Закрыть', variant: 'text' },
      ],
    });
  }

  /* ----------------------------------------------------------
     DASH-V4: 4 STAT KARTA (heroCard/aiCard/energyBox o'chirildi)
     ---------------------------------------------------------- */
  function statsRow(snap) {
    return el('div', { class: 'sl-grid-2' }, [
      slStatCard({ icon: 'chip', value: snap.activeDevices, label: t('dash.activeDevices'),
        color: 'var(--sl-primary)', ariaLabel: t('dash.activeDevices'),
        onClick: () => nav.switchTab('devices') }),
      slStatCard({ icon: 'wifi', value: snap.onlineDevs, label: t('dash.onlineDevices'),
        color: 'var(--sl-online)', ariaLabel: t('dash.onlineDevices'),
        onClick: () => openListDialog(`${t('dash.onlineLakes')} — ${snap.online.length}`,
          snap.online.map((x) => lakeRow(x, { showSignal: true })), t('dash.noOnline')) }),
      slStatCard({ icon: 'power', value: snap.offlineDevs, label: t('dash.offlineDevices'),
        color: snap.offlineDevs ? 'var(--sl-critical)' : 'var(--sl-offline)',
        ariaLabel: t('dash.offlineDevices'),
        onClick: () => openListDialog(`${t('dash.offlineLakes')} — ${snap.offline.length}`,
          snap.offline.map((x) => lakeRow(x, { showSignal: true })), t('dash.allOnline')) }),
      slStatCard({ icon: 'bell', value: snap.alerts.length, label: t('dash.alerts'),
        color: snap.alerts.length ? 'var(--sl-critical)' : 'var(--sl-offline)',
        ariaLabel: t('dash.alerts'),
        onClick: () => openListDialog(`${t('dash.alerts')} — ${snap.alerts.length}`,
          snap.alerts.map((x) => lakeRow(x, { showMsgs: true })), t('dash.noAlerts'),
          { label: t('dash.openAlertsPage'), variant: 'text', onClick: () => nav.switchTab('alerts') }) }),
    ]);
  }

  /* So'nggi ogohlantirishlar (faqat muammo bo'lsa ko'rinadi) */
  function recentAlertsSection(snap) {
    if (!snap.alerts.length) return null;
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

    /* ----------------------------------------------------------
     5 · KO'LLAR (muammolisi birinchi) — v2 tarkibi saqlangan
     ---------------------------------------------------------- */
  function loadWeather(lk) {
    const c = weatherCache.get(lk.id);
    if (c && Date.now() - c.at < WEATHER_TTL) return;
    if (c && c.loading) return;
    weatherCache.set(lk.id, { ...(c || {}), loading: true, at: c ? c.at : 0 });
    getLakeWeather(lk, detectLocale())
      .then((data) => { weatherCache.set(lk.id, { data, at: Date.now() }); scheduleRender(); })
      .catch(() => { weatherCache.set(lk.id, { data: (c && c.data) || null, at: Date.now() }); });
  }

  function lakeSection(snap, st) {
    const sorted = snap.perLake.slice().sort((p, q) =>
      (SEV_ORDER[p.a.status] ?? 9) - (SEV_ORDER[q.a.status] ?? 9));
    const cards = sorted.map((x, i) => {
      loadWeather(x.lake);
      const w = weatherCache.get(x.lake.id);
      const g = gradeOf(x.a.healthScore);

      // Ob-havo qatori
      const extra = [];
      if (w && w.data) {
        extra.push(el('div', { style: 'margin-top:10px' }, [slWeatherCard({
          icon: getWeatherIcon(w.data.code),
          text: `${w.data.district}: ${w.data.temp}°C (${w.data.label})`,
          next: `${t('dash.weatherTomorrow')}: ${w.data.tomorrowTempMax}°C`,
        })]));
      }
      // Bugungi yem jadvali (slFeedSchedule — reusable)
      const m = metaCache.get(x.lake.id);
      if (m !== undefined) {
        const plan = m ? computeFeedPlan({ fish: m.fish || [], feed: m.feed || {}, tempC: x.a.avgTemp, weather: w ? w.data : null }) : null;
        extra.push(slFeedSchedule({
          title: t('dash.todayFeed'),
          totalKg: plan ? plan.dailyKg : null,
          meals: plan ? plan.meals : [],
          emptyText: t('dash.feedNoData'),
        }));
      }
      // Qurilmalar bo'linmasi (v2 funksiyasi saqlangan, DS uslubida)
      if (x.devs.length) {
        extra.push(el('div', { style: 'margin-top:10px;padding-top:8px;border-top:1px dashed var(--sl-border)' },
          x.devs.map((d) => {
            const tel = st.telemetry.get(d.id);
            const online = tel ? presence(tel.ts) === 'online' : false;
            const devSt = online ? deviceStatus(tel, x.th) : 'offline';
            return slKvRow({
              icon: 'chip',
              key: `${d.id.slice(-4)} · ${t('tm.status_' + devSt)}`,
              value: online ? `DO ${tel.do ?? '—'} | ${tel.t ?? '—'}°C` : (isUz ? 'Oflayn' : 'Офлайн'),
              valueColorVar: online ? null : '--sl-offline',
            });
          })));
      }
      extra.push(el('div', { class: 'sl-caption', style: 'margin-top:10px;display:flex;align-items:center;gap:5px' }, [
        el('span', { style: 'display:inline-flex;opacity:.7', html: slIcon('clock', 12) }),
        el('span', { text: `${t('tm.lastUpdate')}: ${fmtAge(x.a.lastUpdate)}` }),
      ]));

      const card = slLakeCard({
        name: x.lake.name,
        status: x.a.status, statusLabel: t('tm.status_' + x.a.status),
        meta: `${x.a.deviceCount} ${t('lake.devices')} · ${x.a.online}/${x.a.deviceCount} ${t('tm.online')}`,
        cells: [
          { icon: 'waves', label: 'DO', value: x.a.avgDo, unit: 'mg/L', colorVar: '--sl-chart-do' },
          { icon: 'thermometer', label: t('tm.temp'), value: x.a.avgTemp, unit: '°C', colorVar: '--sl-chart-temp' },
          { icon: 'activity', label: 'pH', value: x.a.avgPh, unit: '', colorVar: '--sl-chart-ph' },
          { icon: 'sun', label: t('tm.health'), value: x.a.healthScore != null ? `${x.a.healthScore}%` : null,
            unit: '', colorVar: g.colorVar, critical: x.a.healthScore <= 60 && x.devs.length > 0 },
        ],
        extra,
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

  /* ----------------------------------------------------------
     E'LONLAR — oxirgisi, lazy
     ---------------------------------------------------------- */
  const annBox = el('div');
  let annPreview;
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

    /* ----------------------------------------------------------
     8 · OB-HAVO (kichik karta — birinchi ko'l keshidan, o'qishsiz)
     ---------------------------------------------------------- */
  function weatherCard(snap) {
    const first = snap.perLake.find((x) => {
      const w = weatherCache.get(x.lake.id);
      return w && w.data;
    });
    const w = first ? weatherCache.get(first.lake.id).data : null;
    return slCard([
      el('div', { class: 'sl-card-head' }, [
        el('div', { class: 'sl-card-title', text: t('dash.weather') }),
        el('span', { style: 'color:var(--sl-info);display:inline-flex',
          html: slIcon(w ? getWeatherIcon(w.code) : ICONS.misc.weather, 22) }),
      ]),
      w ? slWeatherCard({
        icon: getWeatherIcon(w.code),
        text: `${w.district}: ${w.temp}°C (${w.label})`,
        next: `${t('dash.weatherTomorrow')}: ${w.tomorrowTempMax}°C`,
      }) : el('div', { class: 'sl-body-sm sl-text-secondary', text: t('dash.weatherPlaceholder') }),
    ]);
  }

  /* ----------------------------------------------------------
     RENDER ORKESTRI
     ---------------------------------------------------------- */
  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; renderContent(); });
  }

  function skeleton() {
    return el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-skeleton card', style: 'height:120px' }),
      el('div', { class: 'sl-grid-2' }, [
        el('div', { class: 'sl-skeleton card', style: 'height:96px;margin:0' }),
        el('div', { class: 'sl-skeleton card', style: 'height:96px;margin:0' }),
      ]),
      el('div', { class: 'sl-skeleton card', style: 'height:88px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:150px' }),
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
    if (sig === lastSig && !firstRender) return;   // PERF: o'zgarish yo'q — DOM tinch
    lastSig = sig;

    nav.setBell && nav.setBell(snap.alerts.length > 0);
    loadAnnPreview();

    mount(content, el('div', { class: 'sl-stack' }, [
      statsRow(snap),
      lakeSection(snap, st),
      recentAlertsSection(snap),
      annBox,
    ].filter(Boolean)));

    // Meta'lar fonda — kelgach ko'l kartalarida yem jadvali yangilanadi
    st.lakes.forEach((lk) => ensureMeta(lk.id));
    firstRender = false;
  }

  const unsub = dataStore.subscribe(scheduleRender);
  renderContent();

  node.__cleanup = () => {
    unsub();
    timers.forEach(clearInterval);
  };
  return node;
}

export default renderHomeTab;
