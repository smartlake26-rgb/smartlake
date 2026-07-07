// ============================================================
//  features/lakes/views/lakeDetailView.js — Ko'l detali
//  Biriktirilgan qurilmalar (ajratish) · yangi qurilma biriktirish
//  (faqat egaga tegishli, band bo'lmagan) · tahrirlash · arxivlash ·
//  faollashtirish/deaktivatsiya.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { handleError } from '../../../core/errors.js';
import { LAKE_STATUS } from '../../../core/collections.js';
import { lakeService, deviceAssignmentService } from '../index.js';
import { deviceService } from '../../devices/index.js';
import { authStore } from '../../auth/index.js';

export function renderLakeDetail(ctx = {}) {
  const s = authStore.getState();
  const root = el('div', { class: 'app' });
  const body = el('div', { class: 'auth-wrap' });
  const title = el('div', { class: 'topbar', text: t('lake.detail') });
  mount(root, title, body);

  async function refresh() {
    mount(body, el('div', { text: t('app.loading') }));
    let lake, owned;
    try {
      lake = await lakeService.getLake(ctx.lakeId);
      owned = await deviceService.listByOwner(s.uid);
    } catch (e) {
      mount(body, el('div', { class: 'banner err', text: t(handleError(e, 'lake.detail').messageKey) }));
      return;
    }
    if (!lake) { mount(body, el('div', { class: 'banner err', text: t('error.lakeNotFound') })); return; }

    const attached = owned.filter((d) => (lake.deviceIds || []).includes(d.id));
    const assignable = owned.filter((d) => !d.lakeId);   // o'ziga tegishli, band emas

    // Biriktirilgan qurilmalar
    const attachedEls = attached.length
      ? attached.map((d) => el('div', { class: 'set-row' }, [
        el('span', { style: 'font-family:var(--mono)', text: d.id }),
        el('button', {
          class: 'btn ghost', style: 'width:auto;padding:6px 12px', text: t('lake.unassign'),
          onClick: async () => {
            try { await deviceAssignmentService.unassign(lake.id, d.id, s.uid); toast(t('lake.unassigned'), 'ok'); refresh(); }
            catch (e) { toast(t(handleError(e, 'unassign').messageKey), 'err'); }
          },
        }),
      ]))
      : [el('div', { style: 'color:var(--ink-soft);font-size:13px', text: t('lake.noDevices') })];

    // Biriktirish uchun (band bo'lmagan) qurilma tanlash
    const assignRow = [];
    if (assignable.length) {
      const sel = el('select', {});
      sel.appendChild(el('option', { value: '', text: t('lake.selectDevice') }));
      assignable.forEach((d) => sel.appendChild(el('option', { value: d.id, text: d.id })));
      const btn = el('button', { class: 'btn', style: 'width:auto;padding:8px 14px', text: t('lake.assign') });
      btn.addEventListener('click', async () => {
        if (!sel.value) return;
        btn.disabled = true;
        try { await deviceAssignmentService.assign(lake.id, sel.value, s.uid); toast(t('lake.assigned'), 'ok'); refresh(); }
        catch (e) { toast(t(handleError(e, 'assign').messageKey), 'err'); btn.disabled = false; }
      });
      assignRow.push(el('div', { style: 'display:flex;gap:8px;margin-top:8px' }, [sel, btn]));
    }

    // Status boshqaruvi
    const archived = lake.status === LAKE_STATUS.ARCHIVED;
    const statusBtns = [];
    if (!archived) {
      const toggle = lake.status === LAKE_STATUS.ACTIVE ? LAKE_STATUS.INACTIVE : LAKE_STATUS.ACTIVE;
      statusBtns.push(el('button', {
        class: 'btn ghost', text: t(lake.status === LAKE_STATUS.ACTIVE ? 'lake.deactivate' : 'lake.activate'),
        onClick: async () => {
          try { await lakeService.setStatus(lake.id, toggle, s.uid); toast(t('common.saved'), 'ok'); refresh(); }
          catch (e) { toast(t(handleError(e, 'status').messageKey), 'err'); }
        },
      }));
      statusBtns.push(el('button', {
        class: 'btn ghost', text: t('lake.archive'),
        onClick: async () => {
          try { await lakeService.archive(lake.id, s.uid); toast(t('lake.archived'), 'ok'); ctx.onBack && ctx.onBack(); }
          catch (e) { toast(t(handleError(e, 'archive').messageKey), 'err'); }
        },
      }));
    }

    mount(body,
      el('div', { class: 'card' }, [
        el('div', { style: 'font-weight:800;font-size:18px', text: lake.name }),
        el('div', { style: 'color:var(--ink-soft);font-size:13px;margin-top:4px', text: lake.description || '' }),
        el('div', { style: 'font-size:13px;margin-top:8px', text: `${t('lake.area')}: ${lake.area ?? '—'} · ${t('lake.depth')}: ${lake.averageDepth ?? '—'}` }),
        el('div', { style: 'font-size:13px', text: `${t('lake.status_' + lake.status)}` }),
      ]),
      el('div', { class: 'card' }, [
        el('div', { style: 'font-weight:700;margin-bottom:6px', text: t('lake.attachedDevices') }),
        ...attachedEls,
        ...assignRow,
      ]),
      el('div', { class: 'home-actions' }, [
        el('button', { class: 'btn', text: t('lake.edit'), onClick: () => ctx.onEdit && ctx.onEdit(lake) }),
        ...statusBtns,
        el('button', { class: 'btn ghost', text: t('common.back'), onClick: () => ctx.onBack && ctx.onBack() }),
      ]),
    );
  }
  refresh();

  return root;
}

export default renderLakeDetail;
