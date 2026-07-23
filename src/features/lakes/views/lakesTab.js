// ============================================================
//  features/lakes/views/lakesTab.js — KO'LLAR KATALOGI v4
//  (LAKES-V4, Design System 3.0)
//
//  Bu monitoring paneli EMAS — fermerning ko'llar KATALOGI.
//  Sahifa bevosita katalogdan boshlanadi (yuqori statistika
//  OLIB TASHLANDI — u Dashboardda bor, takror ko'rsatilmaydi).
//
//  Tuzilishi: qidiruv (real vaqt) + 3 tezkor salomatlik filtri
//  (🟢 Sog'lom / 🟡 Normal / 🔴 Muammoli) -> slLakeMonitorCard
//  katalogi (rasm-cover, nom, salomatlik, holat badge, DO,
//  harorat, yangilanish, BUGUNGI YEM JADVALI) -> arxiv -> FAB.
//
//  SAQLANGAN (v3): FAB ko'l qo'shish, karta -> lakeDetailPage
//  (navigatsiya o'zgarmagan), arxiv sahifasi, xatolik/sekin-
//  yuklanish holatlari, internet banneri, dataStore + cleanup.
//
//  PERFORMANCE: bo'lakli (chunk) ro'yxat — birinchi 20 karta
//  darhol, qolganlari sentinel ko'ringanda (IntersectionObserver)
//  20 tadan qo'shiladi; yem-meta faqat chizilgan kartalar uchun
//  yuklanadi. 500 ko'lda ham birinchi render yengil.
//
//  Business logic O'ZGARMAGAN — aggregateLake, presence,
//  rssiQuality, computeFeedPlan, loadLakeMeta (o'qish-faqat).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { appBar, mdFab, mdIconButton } from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { presence } from '../../telemetry/domain/freshness.js';
import { rssiQuality } from '../../telemetry/domain/signalQuality.js';
import { computeFeedPlan } from '../../telemetry/domain/feedEngine.js';
import { loadLakeMeta } from '../../telemetry/services/archiveService.js';
import { renderLakeDetailPage } from './lakeDetailPage.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { openFarmerClaimModal } from '../../devices/views/deviceClaimFlow.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import {
  slIcon, slLakeMonitorCard, slFeedSchedule, slField, slEmptyState, slButton,
} from '../../../design-system/index.js';

const SLOW_LOAD_MS = 12_000;
const CHUNK = 20;                 // bo'lakli render hajmi
const PULL_THRESHOLD = 80;

/* ---------- modul keshi (sessiya) ---------- */
const metaCache = new Map();      // lakeId -> lakeMeta | null | undefined(yuklanmoqda)

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
function monitorKind(lk, a, anyOnline) {
  if (lk.status === LAKE_STATUS.ARCHIVED) return 'archived';
  if (lk.status === LAKE_STATUS.INACTIVE) return 'inactive';
  if (!anyOnline) return 'offline';
  if (a.status === 'critical') return 'critical';
  if (a.status === 'warning') return 'warning';
  return 'online';
}
function lakeVm(lk, st) {
  const th = resolveThresholds(lk);
  const devs = st.devices.filter((d) => d.lakeId === lk.id);
  const a = aggregateLake(devs, st.telemetry, th);
  const anyOnline = devs.some((d) => presence((st.telemetry.get(d.id) || {}).ts) === 'online');
  let bestRssi = null;
  devs.forEach((d) => { const tel = st.telemetry.get(d.id);
    if (tel && typeof tel.rssi === 'number') bestRssi = bestRssi == null ? tel.rssi : Math.max(bestRssi, tel.rssi); });
  return { lk, devs, a, anyOnline, bestRssi, kind: monitorKind(lk, a, anyOnline) };
}

/* Filtr arxitekturasi: kelajakda yangi filtr shu ro'yxatga qo'shiladi.
   [id, i18nKey, dotColorVar, test(vm)] */
const HEALTH_FILTERS = [
  ['healthy', 'lakespg.flt_healthy', '--sl-online',
    (vm) => vm.kind === 'online' && (vm.a.status === 'healthy' || vm.a.status === 'good')],
  ['normal', 'lakespg.flt_normal', '--sl-warning',
    (vm) => vm.kind === 'warning'],
  ['problem', 'lakespg.flt_problem', '--sl-critical',
    (vm) => vm.kind === 'critical' || vm.kind === 'offline'],
];
const SEV = { critical: 0, warning: 1, offline: 2, inactive: 3, archived: 4, online: 5 };

/* ============================================================
   ASOSIY SAHIFA
   ============================================================ */
export function renderLakesTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('lake.myLakes') }),
    content,
    mdFab({ label: t('lake.create'), icon: 'plus',
      onClick: () => nav.push((n) => renderLakeFormPage(n, null)) }),
  ]);

  // --- sahifa holati ---
  let query = '';
  let healthFilter = null;   // null = hammasi
  let firstRender = true;
  let lastSig = '';
  let slowTimer = null;
  let slowLoad = false;
  let listObserver = null;

  /* --- QIDIRUV (reusable slField — real vaqt, faqat ro'yxat yangilanadi) --- */
  const searchField = slField({
    type: 'search', label: '', placeholder: t('lakespg.searchPh'),
    onInput: (e) => { query = e.target.value; renderList(); },
  });
  searchField.querySelector('label').remove();
  searchField.querySelector('.sl-help').remove();
  searchField.input.setAttribute('aria-label', t('lakespg.searchPh'));

  /* --- 3 TEZKOR SALOMATLIK FILTRI (chip) --- */
  const filterChips = new Map();
  const filterRow = el('div', { class: 'sl-tabs', role: 'group', style: 'padding:0' },
    HEALTH_FILTERS.map(([id, key, dotVar]) => {
      const b = el('button', {
        class: 'sl-tab', type: 'button', 'aria-pressed': 'false',
        html: `<span style="width:8px;height:8px;border-radius:50%;background:var(${dotVar});display:inline-block"></span>`
          + `<span>${t(key)}</span>`,
      });
      b.addEventListener('click', () => {
        healthFilter = healthFilter === id ? null : id;   // qayta bosilsa — bekor
        filterChips.forEach((x, xid) => {
          const on = xid === healthFilter;
          x.classList.toggle('active', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        renderList();
      });
      filterChips.set(id, b);
      return b;
    }));

  const toolbar = el('div', { class: 'sl-stack-sm' }, [searchField, filterRow]);

  /* --- internet banneri --- */
  const netBanner = el('div', { class: 'sl-banner warn', role: 'status',
    style: navigator.onLine ? 'display:none' : '', text: t('lakespg.offlineNet') });
  const onNet = () => { netBanner.style.display = navigator.onLine ? 'none' : ''; };
  window.addEventListener('online', onNet);
  window.addEventListener('offline', onNet);

  const listBox = el('div', { class: 'sl-stack' });
  const pullHint = el('div', { class: 'sl-caption',
    style: 'text-align:center;height:0;overflow:hidden;transition:height var(--sl-motion) var(--sl-ease)',
    text: t('hist.pullRefresh') });

  /* ----------------------------------------------------------
     KO'L KARTASI (reusable slLakeMonitorCard + slFeedSchedule)
     ---------------------------------------------------------- */
  function ensureMeta(lakeId, onReady) {
    if (metaCache.has(lakeId)) return;
    metaCache.set(lakeId, undefined);
    loadLakeMeta(lakeId)
      .then((m) => { metaCache.set(lakeId, m); onReady && onReady(m); })
      .catch(() => { metaCache.set(lakeId, null); onReady && onReady(null); });
  }
  function feedNode(vm) {
    const m = metaCache.get(vm.lk.id);
    const plan = m ? computeFeedPlan({ fish: m.fish || [], feed: m.feed || {}, tempC: vm.a.avgTemp }) : null;
    return slFeedSchedule({
      title: t('dash.todayFeed'),
      totalKg: plan ? plan.dailyKg : null,
      meals: plan ? plan.meals : [],
      emptyText: `${t('dash.todayFeed')}: ${t('lakespg.feedPending')}`,
    });
  }
  function buildCard(vm, animIndex = -1) {
    const g = gradeOf(vm.a.healthScore);
    const hasData = vm.devs.length > 0;
    const statusLabel = vm.kind === 'inactive' ? t('lake.status_inactive')
      : vm.kind === 'archived' ? t('lake.status_archived')
      : t('tm.status_' + vm.a.status);
    const q = rssiQuality(vm.bestRssi);
    const feedBox = el('div', {}, [feedNode(vm)]);
    // meta hali kelmagan bo'lsa — kelganda faqat shu blok yangilanadi
    ensureMeta(vm.lk.id, () => mount(feedBox, feedNode(vm)));

    const card = slLakeMonitorCard({
      name: vm.lk.name,
      statusKind: vm.kind,
      statusLabel,
      meta: `${[vm.lk.district, vm.lk.region].filter(Boolean).join(', ')}${vm.lk.district || vm.lk.region ? ' · ' : ''}${vm.devs.length} ${t('lake.devices')}`,
      health: hasData ? vm.a.healthScore : null,
      gradeLabel: t(g.key), gradeColorVar: g.colorVar,
      cells: [
        { icon: 'waves', label: 'DO', value: vm.a.avgDo, unit: 'mg/L', colorVar: '--sl-chart-do' },
        { icon: 'thermometer', label: t('tm.temp'), value: vm.a.avgTemp, unit: '°C', colorVar: '--sl-chart-temp' },
      ],
      updatedText: `${t('lakespg.updated')}: ${fmtAge(vm.a.lastUpdate)}`,
      signalText: vm.bestRssi != null ? `${t('dash.signal')}: ${t('dash.signal_' + q)}` : '',
      extra: [feedBox,
        // ⊕ Qurilma ulash — kartaning pastida, ajralib turadi
        el('div', { style: 'margin-top:var(--sl-sp-3);padding-top:var(--sl-sp-2);border-top:1px solid var(--sl-divider)' }, [
          el('button', {
            type: 'button',
            style: 'display:inline-flex;align-items:center;gap:8px;padding:8px 16px;'
                 + 'border-radius:var(--sl-r-full);border:1.5px dashed var(--sl-primary);'
                 + 'background:color-mix(in srgb,var(--sl-primary) 6%,transparent);'
                 + 'color:var(--sl-primary);font-size:13px;font-weight:700;cursor:pointer;'
                 + 'transition:background var(--sl-motion) var(--sl-ease);width:100%;justify-content:center',
            onClick: (e) => {
              e.stopPropagation();
              openFarmerClaimModal({ lakeId: vm.lk.id, lakeName: vm.lk.name });
            },
          }, [
            el('span', { html: slIcon('plus', 16) }),
            el('span', { text: detectLocale() === 'uz' ? 'Qurilma ulash' : 'Подключить устройство' }),
          ]),
        ]),
      ],
      dim: vm.kind === 'archived' || vm.kind === 'inactive',
      ariaLabel: vm.lk.name,
      onClick: () => nav.push((n) => renderLakeDetailPage(n, vm.lk.id)),   // navigatsiya O'ZGARMAGAN
    });
    if (animIndex >= 0) {
      card.classList.add('sl-anim-up');
      card.style.animationDelay = `${Math.min(animIndex * 60, 240)}ms`;
      card.style.animationFillMode = 'both';
    }
    return card;
  }

  /* ----------------------------------------------------------
     BO'LAKLI RO'YXAT (500 ko'l uchun ham yengil)
     ---------------------------------------------------------- */
  function renderList() {
    if (listObserver) { listObserver.disconnect(); listObserver = null; }
    const st = dataStore.getState();
    const q = query.toLowerCase().trim();
    let vms = st.lakes.map((lk) => lakeVm(lk, st));
    if (q) vms = vms.filter((vm) => (vm.lk.name || '').toLowerCase().includes(q));
    if (healthFilter) {
      const def = HEALTH_FILTERS.find(([id]) => id === healthFilter);
      if (def) vms = vms.filter(def[3]);
    }
    vms.sort((x, y) => (SEV[x.kind] ?? 9) - (SEV[y.kind] ?? 9));   // muammolisi birinchi

    if (!vms.length) {
      mount(listBox, slEmptyState({ icon: 'search', title: t('lakespg.noResults'), desc: '' }));
      return;
    }

    listBox.replaceChildren();
    let rendered = 0;
    const appendChunk = () => {
      const slice = vms.slice(rendered, rendered + CHUNK);
      slice.forEach((vm, i) => listBox.appendChild(
        buildCard(vm, firstRender && rendered === 0 ? i : -1)));
      rendered += slice.length;
      if (rendered < vms.length) {
        const sentinel = el('div', { class: 'sl-skeleton card', style: 'height:60px' });
        listBox.appendChild(sentinel);
        listObserver = new IntersectionObserver((entries) => {
          if (entries.some((en) => en.isIntersecting)) {
            listObserver.disconnect(); listObserver = null;
            sentinel.remove();
            appendChunk();
          }
        }, { rootMargin: '300px' });
        listObserver.observe(sentinel);
      }
    };
    appendChunk();
  }

  function archivedLink(st) {
    if (!st.archivedLakes || !st.archivedLakes.length) return null;
    return el('div', { style: 'padding-top:var(--sl-sp-2);display:flex;justify-content:center' }, [
      slButton({ label: `${t('lake.archivedLakes')} (${st.archivedLakes.length})`,
        variant: 'text', onClick: () => nav.push(renderArchivedLakesTab) }),
    ]);
  }

  /* ----------------------------------------------------------
     HOLATLAR: skeleton / sekin yuklanish / bo'sh
     ---------------------------------------------------------- */
  function skeleton() {
    return el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-skeleton card', style: 'height:48px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:230px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:230px' }),
    ]);
  }
  function errorSlow() {
    return slEmptyState({ icon: 'info', title: t('lakespg.slowLoad'), desc: t('lakespg.loadErrorDesc'),
      action: slButton({ label: t('lakespg.retry'), variant: 'secondary',
        onClick: () => { slowLoad = false; startSlowTimer(); renderContent(true); dataStore.refresh(); } }) });
  }
  function startSlowTimer() {
    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => { slowLoad = true; renderContent(true); }, SLOW_LOAD_MS);
  }

  function signatureOf(st) {
    return JSON.stringify([query, healthFilter,
      st.lakes.map((lk) => {
        const vm = lakeVm(lk, st);
        return [lk.id, lk.name, vm.kind, vm.a.healthScore, vm.a.avgDo, vm.a.avgTemp,
          Math.floor((vm.a.lastUpdate || 0) / 60000)];
      }),
      [...metaCache.keys()].length,
      st.archivedLakes ? st.archivedLakes.length : 0]);
  }

  function renderContent(force = false) {
    const st = dataStore.getState();
    if (st.loading) {
      mount(content, slowLoad ? errorSlow() : skeleton());
      lastSig = '';
      return;
    }
    clearTimeout(slowTimer); slowLoad = false;

    if (!st.lakes.length) {
      mount(content, el('div', { class: 'sl-stack' }, [
        slEmptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint'),
          action: slButton({ label: t('lake.create'), icon: 'plus',
            onClick: () => nav.push((n) => renderLakeFormPage(n, null)) }) }),
        archivedLink(st),
      ].filter(Boolean)));
      lastSig = '';
      return;
    }

    const sig = signatureOf(st);
    if (!force && sig === lastSig && !firstRender) return;   // PERF
    lastSig = sig;

    renderList();
    mount(content, el('div', { class: 'sl-stack' }, [
      pullHint, netBanner, toolbar, listBox, archivedLink(st),
    ].filter(Boolean)));
    firstRender = false;
  }

  /* --- PULL-TO-REFRESH --- */
  let pullStartY = null;
  content.addEventListener('touchstart', (e) => {
    pullStartY = (window.scrollY <= 0) ? e.touches[0].clientY : null;
  }, { passive: true });
  content.addEventListener('touchmove', (e) => {
    if (pullStartY == null) return;
    pullHint.style.height = (e.touches[0].clientY - pullStartY) > 24 ? '20px' : '0';
  }, { passive: true });
  content.addEventListener('touchend', (e) => {
    if (pullStartY == null) return;
    const dy = e.changedTouches[0].clientY - pullStartY;
    pullHint.style.height = '0';
    pullStartY = null;
    if (dy > PULL_THRESHOLD) dataStore.refresh();
  }, { passive: true });

  startSlowTimer();
  const unsub = dataStore.subscribe(() => renderContent());
  renderContent();
  node.__cleanup = () => {
    unsub();
    clearTimeout(slowTimer);
    if (listObserver) listObserver.disconnect();
    window.removeEventListener('online', onNet);
    window.removeEventListener('offline', onNet);
  };
  return node;
}

/* ============================================================
   ARXIVLANGAN KO'LLAR (saqlangan funksiya)
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
        const g = gradeOf(vm.a.healthScore);
        return slLakeMonitorCard({
          name: vm.lk.name, statusKind: 'archived',
          statusLabel: t('lake.status_archived'),
          meta: `${vm.devs.length} ${t('lake.devices')}`,
          health: vm.devs.length ? vm.a.healthScore : null,
          gradeLabel: t(g.key), gradeColorVar: g.colorVar,
          updatedText: `${t('lakespg.updated')}: ${fmtAge(vm.a.lastUpdate)}`,
          dim: true, ariaLabel: vm.lk.name,
          onClick: () => nav.push((n) => renderLakeDetailPage(n, vm.lk.id)),
        });
      })));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderLakesTab;
