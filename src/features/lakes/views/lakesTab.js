// ============================================================
//  features/lakes/views/lakesTab.js — KO'LLAR SAHIFASI v3
//  Premium monitoring (LAKES-V3, Design System 3.0)
//
//  Tuzilishi: sarlavha -> mini-statlar (Jami/Onlayn/Oflayn/
//  Ogohlantirish) -> qidiruv + saralash -> slLakeMonitorCard
//  ro'yxati ("Apple Weather" uslubi) -> arxiv havolasi -> FAB.
//
//  SAQLANGAN funksiyalar (v2): FAB orqali ko'l qo'shish
//  (lakeFormPage), karta bosilganda lakeDetailPage (o'sha
//  navigatsiya, o'sha lakeId uzatish), inactive/archived
//  statuslar, arxiv sahifasi, dataStore obunasi + cleanup.
//
//  YANGI: qidiruv (nomi bo'yicha; filtr arxitekturasi tayyor —
//  matchers ro'yxati), saralash (nomi/salomatlik/onlayn/
//  yangilanish), signal sifati, xatolik holatlari (internet
//  yo'q / sekin yuklanish -> retry), skeleton, sig-memo.
//
//  Business logic O'ZGARMAGAN — hisoblar mavjud domen
//  modullaridan (aggregateLake, presence, rssiQuality).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { appBar, mdFab, mdIconButton } from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { presence } from '../../telemetry/domain/freshness.js';
import { rssiQuality } from '../../telemetry/domain/signalQuality.js';
import { renderLakeDetailPage } from './lakeDetailPage.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import {
  slLakeMonitorCard, slStatCard, slField, slEmptyState, slButton,
} from '../../../design-system/index.js';

const SLOW_LOAD_MS = 12_000;

/* ---------- sof yordamchilar ---------- */
function fmtAge(ts) {
  if (ts == null) return '—';
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? t('tm.justNow') : m < 60 ? `${m} ${t('tm.minAgo')}` : `${Math.floor(m / 60)} ${t('tm.hourAgo')}`;
}
function gradeOf(score) {
  if (score >= 90) return { key: 'dash.gradeA', colorVar: '--sl-success' };
  if (score >= 75) return { key: 'dash.gradeB', colorVar: '--sl-success' };
  if (score >= 60) return { key: 'dash.gradeC', colorVar: '--sl-warning' };
  return { key: 'dash.gradeD', colorVar: '--sl-critical' };
}
/* aggregate status + lake status -> monitor karta holati */
function monitorKind(lk, a, anyOnline) {
  if (lk.status === LAKE_STATUS.ARCHIVED) return 'archived';
  if (lk.status === LAKE_STATUS.INACTIVE) return 'inactive';
  if (!anyOnline) return 'offline';
  if (a.status === 'critical') return 'critical';
  if (a.status === 'warning') return 'warning';
  return 'online';
}

/* Bitta ko'l bo'yicha to'liq ko'rinish modeli (sof). */
function lakeVm(lk, st) {
  const th = resolveThresholds(lk);
  const devs = st.devices.filter((d) => d.lakeId === lk.id);
  const a = aggregateLake(devs, st.telemetry, th);
  const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');
  let bestRssi = null;
  devs.forEach((d) => {
    const tel = st.telemetry.get(d.id);
    if (tel && typeof tel.rssi === 'number') bestRssi = bestRssi == null ? tel.rssi : Math.max(bestRssi, tel.rssi);
  });
  return { lk, devs, a, anyOnline, bestRssi, kind: monitorKind(lk, a, anyOnline) };
}

/* Qidiruv arxitekturasi: matchers ro'yxati — kelajakda filtr
   (viloyat, status, ...) shu ro'yxatga qo'shiladi. */
const MATCHERS = [
  (vm, q) => !q || (vm.lk.name || '').toLowerCase().includes(q),
];
function applySearch(vms, q) {
  const s = q.toLowerCase().trim();
  return vms.filter((vm) => MATCHERS.every((m) => m(vm, s)));
}

const SEV = { critical: 0, warning: 1, offline: 2, inactive: 3, archived: 4, online: 5 };
const SORTERS = {
  health: (x, y) => (SEV[x.kind] ?? 9) - (SEV[y.kind] ?? 9) || (x.a.healthScore - y.a.healthScore),
  name: (x, y) => (x.lk.name || '').localeCompare(y.lk.name || '', undefined, { numeric: true }),
  online: (x, y) => Number(y.anyOnline) - Number(x.anyOnline) || (SEV[x.kind] ?? 9) - (SEV[y.kind] ?? 9),
  updated: (x, y) => (y.a.lastUpdate || 0) - (x.a.lastUpdate || 0),
};

/* VM -> reusable monitor karta (DS). */
function buildMonitorCard(vm, nav, { animIndex = -1 } = {}) {
  const { lk, a, kind, bestRssi } = vm;
  const g = gradeOf(a.healthScore);
  const hasData = vm.devs.length > 0;
  const statusLabel = kind === 'inactive' ? t('lake.status_inactive')
    : kind === 'archived' ? t('lake.status_archived')
    : t('tm.status_' + a.status);
  const q = rssiQuality(bestRssi);
  const card = slLakeMonitorCard({
    name: lk.name,
    statusKind: kind,
    statusLabel,
    meta: `${[lk.district, lk.region].filter(Boolean).join(', ')}${lk.district || lk.region ? ' · ' : ''}${vm.devs.length} ${t('lake.devices')}`,
    health: hasData ? a.healthScore : null,
    gradeLabel: t(g.key),
    gradeColorVar: g.colorVar,
    cells: [
      { icon: 'waves', label: 'DO', value: a.avgDo, unit: 'mg/L', colorVar: '--sl-chart-do' },
      { icon: 'thermometer', label: t('tm.temp'), value: a.avgTemp, unit: '°C', colorVar: '--sl-chart-temp' },
    ],
    updatedText: `${t('lakespg.updated')}: ${fmtAge(a.lastUpdate)}`,
    signalText: bestRssi != null ? `${t('dash.signal')}: ${t('dash.signal_' + q)} (${bestRssi} dBm)` : '',
    dim: kind === 'archived' || kind === 'inactive',
    ariaLabel: lk.name,
    onClick: () => nav.push((n) => renderLakeDetailPage(n, lk.id)),   // navigatsiya O'ZGARMAGAN
  });
  if (animIndex >= 0) {
    card.classList.add('sl-anim-up');
    card.style.animationDelay = `${Math.min(animIndex * 60, 240)}ms`;
    card.style.animationFillMode = 'both';
  }
  return card;
}

/* ============================================================
   ASOSIY SAHIFA
   ============================================================ */
export function renderLakesTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('lake.myLakes') }),
    content,
    mdFab({ label: t('lake.create'), icon: 'plus',
      onClick: () => nav.push((n) => renderLakeFormPage(n, null)) }),   // saqlangan funksiya
  ]);

  // --- sahifa holati (emit'lar orasida saqlanadi) ---
  let query = '';
  let sortKey = 'health';
  let firstRender = true;
  let lastSig = '';
  let slowTimer = null;
  let slowLoad = false;

  // --- qidiruv + saralash paneli (BIR MARTA quriladi — fokus yo'qolmaydi) ---
  const searchField = slField({
    type: 'search', label: '', placeholder: t('lakespg.searchPh'),
    onInput: (e) => { query = e.target.value; renderList(); },
  });
  searchField.querySelector('label').remove();
  searchField.querySelector('.sl-help').remove();
  searchField.input.setAttribute('aria-label', t('lakespg.searchPh'));
  searchField.classList.add('sl-grow');

  const sortField = slField({
    type: 'dropdown', label: '',
    options: ['health', 'name', 'online', 'updated'].map((k) => ({ value: k, label: t('lakespg.sort_' + k) })),
    selected: sortKey,
    onChange: (e) => { sortKey = e.target.value; renderList(); },
  });
  sortField.querySelector('label').remove();
  sortField.querySelector('.sl-help').remove();
  sortField.input.setAttribute('aria-label', t('lakespg.sortBy'));
  sortField.style.maxWidth = '160px';

  const toolbar = el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-2);align-items:stretch' },
    [searchField, sortField]);

  // --- internet holati banneri ---
  const netBanner = el('div', { class: 'sl-banner warn', role: 'status',
    style: navigator.onLine ? 'display:none' : '' , text: t('lakespg.offlineNet') });
  const onNet = () => { netBanner.style.display = navigator.onLine ? 'none' : ''; };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);

  // --- doimiy konteynerlar ---
  const statsBox = el('div');
  const listBox = el('div', { class: 'sl-stack' });

  function statsRow(vms) {
    const online = vms.filter((v) => v.anyOnline).length;
    const alerts = vms.filter((v) => v.a.hasAlarm).length;
    return el('div', { class: 'sl-grid-2' }, [
      slStatCard({ icon: 'droplet', value: vms.length, label: t('lakespg.total'), color: 'var(--sl-primary)' }),
      slStatCard({ icon: 'wifi', value: online, label: t('lakespg.online'), color: 'var(--sl-online)' }),
      slStatCard({ icon: 'power', value: vms.length - online, label: t('lakespg.offline'),
        color: vms.length - online ? 'var(--sl-critical)' : 'var(--sl-offline)' }),
      slStatCard({ icon: 'bell', value: alerts, label: t('lakespg.alerts'),
        color: alerts ? 'var(--sl-warning)' : 'var(--sl-offline)' }),
    ]);
  }

  function archivedLink(st) {
    if (!st.archivedLakes || !st.archivedLakes.length) return null;
    return el('div', { style: 'padding-top:var(--sl-sp-2);display:flex;justify-content:center' }, [
      slButton({ label: `${t('lake.archivedLakes')} (${st.archivedLakes.length})`,
        variant: 'text', onClick: () => nav.push(renderArchivedLakesTab) }),
    ]);
  }

  /* Faqat ro'yxat qismini yangilaydi (qidiruv/saralashda statlar tinch). */
  function renderList() {
    const st = dataStore.getState();
    const vms = st.lakes.map((lk) => lakeVm(lk, st));
    const filtered = applySearch(vms, query).sort(SORTERS[sortKey] || SORTERS.health);
    if (!filtered.length) {
      mount(listBox, slEmptyState({ icon: 'search', title: t('lakespg.noResults'), desc: '' }));
      return;
    }
    mount(listBox, ...filtered.map((vm, i) =>
      buildMonitorCard(vm, nav, { animIndex: firstRender ? i : -1 })));
  }

  function skeleton() {
    return el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-grid-2' }, Array.from({ length: 4 }, () =>
        el('div', { class: 'sl-skeleton card', style: 'height:96px;margin:0' }))),
      el('div', { class: 'sl-skeleton card', style: 'height:210px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:210px' }),
    ]);
  }

  function errorSlow() {
    return el('div', {}, [
      slEmptyState({ icon: 'info', title: t('lakespg.slowLoad'), desc: t('lakespg.loadErrorDesc'),
        action: slButton({ label: t('lakespg.retry'), variant: 'secondary',
          onClick: () => { slowLoad = false; startSlowTimer(); renderContent(true); dataStore.refresh(); } }) }),
    ]);
  }

  function startSlowTimer() {
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { slowLoad = true; renderContent(true); }, SLOW_LOAD_MS);
  }

  function signatureOf(vms, st) {
    return JSON.stringify([query, sortKey,
      vms.map((v) => [v.lk.id, v.lk.name, v.kind, v.a.healthScore, v.a.avgDo, v.a.avgTemp,
        Math.floor((v.a.lastUpdate || 0) / 60000), v.bestRssi]),
      st.archivedLakes ? st.archivedLakes.length : 0]);
  }

  function renderContent(force = false) {
    const st = dataStore.getState();
    if (st.loading) {
      if (slowLoad) { mount(content, errorSlow()); return; }
      mount(content, skeleton());
      lastSig = '';
      return;
    }
    clearTimeout(slowTimer); slowLoad = false;

    if (!st.lakes.length) {
      const kids = [
        slEmptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint'),
          action: slButton({ label: t('lake.create'), icon: 'plus',
            onClick: () => nav.push((n) => renderLakeFormPage(n, null)) }) }),
        archivedLink(st),
      ].filter(Boolean);
      mount(content, el('div', { class: 'sl-stack' }, kids));
      lastSig = '';
      return;
    }

    const vms = st.lakes.map((lk) => lakeVm(lk, st));
    const sig = signatureOf(vms, st);
    if (!force && sig === lastSig && !firstRender) return;   // PERF: o'zgarish yo'q
    lastSig = sig;

    mount(statsBox, statsRow(vms));
    renderList();
    mount(content, el('div', { class: 'sl-stack' }, [
      netBanner, statsBox, toolbar, listBox, archivedLink(st),
    ].filter(Boolean)));
    firstRender = false;
  }

  startSlowTimer();
  const unsub = dataStore.subscribe(() => renderContent());
  renderContent();
  node.__cleanup = () => {
    unsub();
    clearTimeout(slowTimer);
    window.removeEventListener('online', onNet);
    window.removeEventListener('offline', onNet);
  };
  return node;
}

/* ============================================================
   ARXIVLANGAN KO'LLAR (saqlangan funksiya, yangi ko'rinishda)
   ============================================================ */
export function renderArchivedLakesTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('lake.archivedLakes'),
      leading: mdIconButton({ icon: 'arrowLeft', onClick: () => nav.back() }) }),
    content,
  ]);

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) {
      mount(content, el('div', { class: 'sl-skeleton card', style: 'height:210px' }));
      return;
    }
    if (!st.archivedLakes || !st.archivedLakes.length) {
      mount(content, slEmptyState({ icon: 'droplet', title: t('lake.emptyArchived'), desc: '' }));
      return;
    }
    mount(content, el('div', { class: 'sl-stack' },
      st.archivedLakes.map((lk) => {
        const vm = lakeVm(lk, st);
        vm.kind = 'archived';
        return buildMonitorCard(vm, nav);
      })));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderLakesTab;
