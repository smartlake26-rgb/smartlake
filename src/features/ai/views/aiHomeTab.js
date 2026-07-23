// ============================================================
//  features/ai/views/aiHomeTab.js — AI tabi (DASH-V3, nav darajasi)
//  Mavjud buildAiTab (ko'l darajasidagi AI tavsiya moduli) QAYTA
//  ISHLATILADI — hech qanday AI logikasi takrorlanmagan. Bu fayl
//  faqat: ko'l tanlovi (sl-tabs) + tanlangan ko'l uchun aiTab.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { appBar, skeletonCards, emptyState } from '../../../shared/ui/index.js';
import { authStore } from '../../auth/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { loadLakeMeta } from '../../telemetry/services/archiveService.js';
import { buildAiTab } from './aiTab.js';

export function renderAiHomeTab(nav) {
  const s = authStore.getState();
  const isUz = detectLocale() === 'uz';
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('nav.ai') }), content]);

  let selectedLakeId = null;
  let aiNode = null;                 // buildAiTab natijasi (keshlangan, ko'l almashsa qayta quriladi)
  const metaCache = new Map();       // lakeId -> lakeMeta (sessiya ichida 1 o'qish)

  function buildFor(lakeId) {
    aiNode = buildAiTab({
      isUz,
      getParams: () => {
        const st = dataStore.getState();
        const lk = st.lakes.find((l) => l.id === lakeId) || { id: lakeId, name: '' };
        const devs = st.devices.filter((d) => d.lakeId === lakeId);
        return {
          lake: lk, devs, telemetry: st.telemetry,
          th: resolveThresholds(lk),
          meta: metaCache.get(lakeId) || null,
          uid: s.uid, weather: null,
        };
      },
      onGoTab: () => {},   // nav darajasida ichki tab almashuvi yo'q
    });
    // Meta fonda yuklanadi (bitta o'qish) — yem tavsiyasi aniqroq bo'ladi
    if (!metaCache.has(lakeId)) {
      loadLakeMeta(lakeId).then((m) => { metaCache.set(lakeId, m); }).catch(() => {});
    }
  }

  function render() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.lakes.length) {
      mount(content, emptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint') }));
      return;
    }
    if (!selectedLakeId || !st.lakes.some((l) => l.id === selectedLakeId)) {
      selectedLakeId = st.lakes[0].id;
      buildFor(selectedLakeId);
    }
    if (!aiNode) buildFor(selectedLakeId);

    // Ko'l tanlovi (DS sl-tabs)
    const tabs = el('div', { class: 'sl-tabs', role: 'tablist' }, st.lakes.map((lk) => {
      const b = el('button', {
        class: `sl-tab${lk.id === selectedLakeId ? ' active' : ''}`,
        type: 'button', role: 'tab',
        'aria-selected': lk.id === selectedLakeId ? 'true' : 'false',
        text: lk.name,
      });
      b.addEventListener('click', () => {
        if (lk.id === selectedLakeId) return;
        selectedLakeId = lk.id; buildFor(lk.id); render();
      });
      return b;
    }));

    mount(content, el('div', { class: 'sl-stack' }, [
      st.lakes.length > 1 ? tabs : null,
      aiNode,
    ].filter(Boolean)));
  }

  const unsub = dataStore.subscribe(render);
  render();
  node.__cleanup = unsub;
  return node;
}

export default renderAiHomeTab;
