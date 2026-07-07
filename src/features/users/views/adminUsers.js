// ============================================================
//  features/users/views/adminUsers.js — Foydalanuvchilar jadvali (admin)
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';

export function renderAdminUsers() {
  const wrap = el('div', {});
  function render() {
    const st = adminStore.getState();
    const rows = st.users.map((u) => ({
      uid: u.uid, name: `${u.profile?.ism || ''} ${u.profile?.fam || ''}`.trim() || '—',
      email: u.email || '—', role: u.role || 'farmer', region: u.profile?.vil || '—', status: u.status || 'active',
    }));
    mount(wrap, dataTable({
      columns: [
        { key: 'name', label: t('profile.firstName') },
        { key: 'email', label: t('common.email') },
        { key: 'role', label: t('settings.role'), render: (r) => pill(t('role.' + r.role), 'primary') },
        { key: 'region', label: t('tm.region') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('user.' + r.status), r.status === 'active' ? 'active' : 'suspended') },
      ],
      rows, pageSize: 14,
      filters: [{ key: 'role', label: t('settings.role'), options: ['farmer', 'operator', 'region', 'super'].map((r) => ({ value: r, label: t('role.' + r) })) }],
    }));
  }
  const unsub = adminStore.subscribe(render); render(); wrap.__cleanup = unsub; return wrap;
}
export default renderAdminUsers;
