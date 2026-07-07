// ============================================================
//  features/lakes/views/lakesListView.js — Fermer ko'llari ro'yxati
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import { lakeService } from '../services/lakeService.js';
import { authStore } from '../../auth/index.js';

export function renderLakesList(ctx = {}) {
  const s = authStore.getState();
  const listEl = el('div', {});

  function statusBadge(status) {
    const label = t('lake.status_' + status);
    const color = status === LAKE_STATUS.ACTIVE ? 'var(--ok)' : status === LAKE_STATUS.INACTIVE ? 'var(--warn)' : 'var(--ink-soft)';
    return el('span', { class: 'role-badge', style: `color:${color}`, text: label });
  }

  function card(lake) {
    return el('div', {
      class: 'card', style: 'margin-bottom:10px;cursor:pointer',
      onClick: () => ctx.onOpen && ctx.onOpen(lake.id),
    }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:center' }, [
        el('div', { style: 'font-weight:700;font-size:16px', text: lake.name }),
        statusBadge(lake.status),
      ]),
      el('div', { style: 'font-size:13px;color:var(--ink-soft);margin-top:4px', text: `${lake.district || ''} ${lake.region || ''} · ${(lake.deviceIds || []).length} ${t('lake.devices')}` }),
    ]);
  }

  async function load() {
    mount(listEl, el('div', { text: t('app.loading') }));
    try {
      const lakes = await lakeService.listByOwner(s.uid);
      if (!lakes.length) { mount(listEl, el('div', { class: 'banner', text: t('lake.empty') })); return; }
      mount(listEl, ...lakes.map(card));
    } catch (e) {
      mount(listEl, el('div', { class: 'banner err', text: t(handleError(e, 'lakes.load').messageKey) }));
    }
  }
  load();

  return el('div', { class: 'app' }, [
    el('div', { class: 'topbar', text: t('lake.myLakes') }),
    el('div', { class: 'auth-wrap' }, [
      el('button', { class: 'btn', style: 'margin-bottom:12px', html: `${icon('plus', 18)} ${t('lake.create')}`, onClick: () => ctx.onCreate && ctx.onCreate() }),
      listEl,
      el('button', { class: 'btn ghost', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
    ]),
  ]);
}

export default renderLakesList;
