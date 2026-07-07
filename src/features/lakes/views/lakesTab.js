// ============================================================
//  features/lakes/views/lakesTab.js — Ko'llar tab
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { appBar, mdFab, mdCard, statusChip, skeletonCards, emptyState } from '../../../shared/ui/index.js';
import * as dataStore from '../../../farmer/dataStore.js';
import { resolveThresholds } from '../../telemetry/domain/thresholds.js';
import { aggregateLake } from '../../telemetry/domain/aggregate.js';
import { renderLakeDetailPage } from './lakeDetailPage.js';
import { renderLakeFormPage } from './lakeFormPage.js';
import { LAKE_STATUS } from '../../../core/collections.js';

export function renderLakesTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [
    appBar({ title: t('lake.myLakes') }),
    content,
    mdFab({ label: t('lake.create'), icon: 'plus', onClick: () => nav.push((n) => renderLakeFormPage(n, null)) }),
  ]);

  function card(lk, st) {
    const devs = st.devices.filter((d) => d.lakeId === lk.id);
    const a = aggregateLake(devs, st.telemetry, resolveThresholds(lk));
    const statusLabel = lk.status === LAKE_STATUS.INACTIVE ? t('lake.status_inactive') : t('tm.status_' + a.status);
    const statusKind = lk.status === LAKE_STATUS.INACTIVE ? 'offline' : a.status;
    return mdCard([
      el('div', { class: 'row-between' }, [
        el('div', { class: 't-title', text: lk.name }),
        statusChip(statusKind, statusLabel),
      ]),
      el('div', { class: 't-body-sm muted', style: 'margin-top:4px', text:
        `${lk.district || ''} ${lk.region || ''} · ${devs.length} ${t('lake.devices')}` }),
    ], { elevated: true, cls: 'anim-up', onClick: () => nav.push((n) => renderLakeDetailPage(n, lk.id)) });
  }

  function renderContent() {
    const st = dataStore.getState();
    if (st.loading) { mount(content, skeletonCards(3)); return; }
    if (!st.lakes.length) { mount(content, emptyState({ icon: 'droplet', title: t('lake.empty'), desc: t('home.emptyHint') })); return; }
    mount(content, el('div', { class: 'stack' }, st.lakes.map((lk) => card(lk, st))));
  }

  const unsub = dataStore.subscribe(renderContent);
  renderContent();
  node.__cleanup = unsub;
  return node;
}

export default renderLakesTab;
