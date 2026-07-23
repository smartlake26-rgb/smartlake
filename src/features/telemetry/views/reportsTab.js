// ============================================================
//  features/telemetry/views/reportsTab.js — HISOBOT tabi (DASH-V3)
//  Mavjud buildHistoryTab (davr filtrlari, jadval, XLSX/CSV/PDF
//  eksport, elektr va yem hisobi) QAYTA ISHLATILADI — hech qanday
//  hisob-kitob logikasi takrorlanmagan. Bu fayl faqat ko'l tanlovi
//  + tanlangan ko'l uchun tayyor hisobot modulini ko'rsatadi.
//  Eksport kutubxonalari (xlsx/jspdf) avvalgidek FAQAT bosilganda
//  dynamic-import bo'ladi — dashboard bundle'i og'irlashmaydi.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { appBar, skeletonCards } from '../../../shared/ui/index.js';
import { slEmptyState } from '../../../design-system/index.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../domain/thresholds.js';
import { buildHistoryTab } from './historyTab.js';

export function renderReportsTab(nav) {
  const s = authStore.getState();
  const isUz = detectLocale() === 'uz';
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('reports.title'), subtitle: t('reports.hint') }),
    content,
  ]);

  let selectedLakeId = null;
  const historyNodes = new Map();   // lakeId -> tayyor hisobot Node (lazy, keshlanadi)

  function historyFor(lakeId) {
    if (!historyNodes.has(lakeId)) {
      historyNodes.set(lakeId, buildHistoryTab({
        lakeId, uid: s.uid, isUz,
        getDevs: () => dataStore.getState().devices.filter((d) => d.lakeId === lakeId),
        getTh: () => {
          const st = dataStore.getState();
          const lk = st.lakes.find((l) => l.id === lakeId);
          return resolveThresholds(lk);
        },
      }));
    }
    return historyNodes.get(lakeId);
  }

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.lakes.length) {
      mount(content, slEmptyState({ icon: 'trendUp', title: t('reports.empty'), desc: t('home.emptyHint') }));
      return;
    }
    if (!selectedLakeId || !st.lakes.some((l) => l.id === selectedLakeId)) {
      selectedLakeId = st.lakes[0].id;
    }

    const tabs = el('div', { class: 'sl-tabs', role: 'tablist', 'aria-label': t('reports.pickLake') },
      st.lakes.map((lk) => {
        const b = el('button', {
          class: `sl-tab${lk.id === selectedLakeId ? ' active' : ''}`,
          type: 'button', role: 'tab',
          'aria-selected': lk.id === selectedLakeId ? 'true' : 'false',
          text: lk.name,
        });
        b.addEventListener('click', () => {
          if (lk.id === selectedLakeId) return;
          selectedLakeId = lk.id; render();
        });
        return b;
      }));

    mount(content, el('div', { class: 'sl-stack' }, [
      st.lakes.length > 1 ? tabs : null,
      historyFor(selectedLakeId),
    ].filter(Boolean)));
  }

  const unsub = dataStore.subscribe(render);
  render();
  node.__cleanup = unsub;
  return node;
}

export default renderReportsTab;
