// ============================================================
//  features/users/views/adminUsers.js — Foydalanuvchilar jadvali (admin)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill, select, field, openDialog } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { authStore } from '../../auth/index.js';
import { userService } from '../services/userService.js';
import { toast } from '../../../shared/toast.js';
import { handleError } from '../../../core/errors.js';
import { VILOYATLAR } from '../../../core/config.js';

export function renderAdminUsers() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const me = authStore.getState();
    const isSuperAdmin = me.role === 'super';

    const rows = st.users.map((u) => ({
      uid: u.uid, name: `${u.profile?.ism || ''} ${u.profile?.fam || ''}`.trim() || '—',
      email: u.email || '—', role: u.role || 'farmer',
      region: u.role === 'region' ? (u.regions && u.regions.length ? u.regions.join(', ') : '—') : (u.profile?.vil || '—'),
      status: u.status || 'active',
    }));
    const columns = [
      { key: 'name', label: t('profile.firstName') },
      { key: 'email', label: t('common.email') },
      { key: 'role', label: t('settings.role'), render: (r) => pill(t('role.' + r.role), 'primary') },
      { key: 'region', label: t('tm.region') },
      { key: 'status', label: t('tm.status'), render: (r) => pill(t('user.' + r.status), r.status === 'active' ? 'active' : 'suspended') },
    ];

    if (isSuperAdmin) {
      columns.push({
        key: 'uid',
        label: "Amallar",
        render: (row) => el('button', {
          style: 'background:var(--md-primary); color:#fff; border:none; padding:5px 12px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;',
          text: 'Roli va viloyatini tahrirlash'
        })
      });
    }

    mount(wrap, dataTable({
      columns,
      rows, pageSize: 14,
      filters: [{ key: 'role', label: t('settings.role'), options: ['farmer', 'operator', 'region', 'super'].map((r) => ({ value: r, label: t('role.' + r) })) }],
      onRowClick: isSuperAdmin ? (row) => {
        const user = st.users.find((u) => u.uid === row.uid);
        if (!user) return;

        const roleOptions = [
          { value: 'farmer', label: t('role.farmer') },
          { value: 'operator', label: t('role.operator') },
          { value: 'region', label: t('role.region') },
          { value: 'super', label: t('role.super') },
        ];

        const statusOptions = [
          { value: 'active', label: t('user.active') },
          { value: 'suspended', label: t('user.suspended') },
        ];

        const roleSelect = select(roleOptions, user.role || 'farmer');
        const statusSelect = select(statusOptions, user.status || 'active');

        // Checkbox container for region manager regions
        const regionContainer = el('div', { class: 'stack', style: 'gap:6px; max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--md-outline-variant); border-radius: 8px; background: var(--md-surface-container);' });
        const checkboxes = [];
        const currentRegions = user.regions || [];

        VILOYATLAR.forEach((viloyat) => {
          const isChecked = currentRegions.includes(viloyat);
          const cb = el('input', { type: 'checkbox', value: viloyat, style: 'cursor:pointer; width:18px; height:18px;' });
          if (isChecked) {
            cb.checked = true;
          }
          const item = el('label', { class: 'row', style: 'gap:10px; cursor:pointer; align-items:center; padding: 4px 0;' }, [
            cb,
            el('span', { class: 't-body-sm', text: viloyat })
          ]);
          checkboxes.push({ cb, value: viloyat });
          regionContainer.appendChild(item);
        });

        const regionSection = el('div', { style: 'display:' + (user.role === 'region' ? 'block' : 'none') }, [
          el('div', { class: 't-label', style: 'margin-bottom:6px; font-weight:500; color:var(--md-primary); margin-top:8px;', text: "Biriktirilgan viloyatlar (Maksimal 10 ta)" }),
          regionContainer
        ]);

        roleSelect.addEventListener('change', () => {
          if (roleSelect.value === 'region') {
            regionSection.style.display = 'block';
          } else {
            regionSection.style.display = 'none';
          }
        });

        const formBody = el('div', { class: 'stack', style: 'gap:12px; margin-top:8px;' }, [
          el('div', { class: 't-body', style: 'font-weight: 500; margin-bottom: 8px;', text: `${user.profile?.ism || ''} ${user.profile?.fam || ''} (${user.email || '—'})` }),
          field(t('settings.role'), roleSelect),
          field(t('tm.status'), statusSelect),
          regionSection,
        ]);

        openDialog({
          title: "Foydalanuvchini tahrirlash",
          body: formBody,
          actions: [
            { label: t('common.cancel'), variant: 'text' },
            {
              label: t('common.save'),
              variant: 'filled',
              onClick: async () => {
                try {
                  const newRole = roleSelect.value;
                  const newStatus = statusSelect.value;
                  let updated = false;

                  if (newRole !== user.role) {
                    await userService.updateRole(user.uid, newRole);
                    updated = true;
                  }
                  if (newStatus !== user.status) {
                    await userService.updateStatus(user.uid, newStatus);
                    updated = true;
                  }

                  if (newRole === 'region') {
                    const selectedRegions = checkboxes.filter(item => item.cb.checked).map(item => item.value);
                    const oldRegions = user.regions || [];
                    const isRegionsChanged = oldRegions.length !== selectedRegions.length || !selectedRegions.every(r => oldRegions.includes(r));
                    if (isRegionsChanged) {
                      await userService.updateRegions(user.uid, selectedRegions);
                      updated = true;
                    }
                  }

                  if (updated) {
                    toast(t('common.saved') || 'Saqlandi', 'ok');
                    await adminStore.refresh();
                  }
                } catch (e) {
                  toast(t(handleError(e, 'adminUsers.update').messageKey), 'err');
                }
              },
            },
          ],
        });
      } : null,
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminUsers;
