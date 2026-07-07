// ============================================================
//  features/audit/views/adminAudit.js — Audit jurnali (admin, faqat-o'qish)
//  Sprint-7 Cloud Function to'ldirguncha bo'sh (real empty state).
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable } from '../../../shared/ui/index.js';
import { auditService } from '../index.js';

export function renderAdminAudit() {
  const wrap = el('div', {});
  mount(wrap, el('div', { class: 'dt-empty', text: t('app.loading') }));
  auditService.listRecent(150).then((rows) => {
    mount(wrap, dataTable({
      columns: [
        { key: 'ts', label: t('audit.time'), render: (r) => el('span', { text: r.ts ? new Date(r.ts).toLocaleString() : '—' }) },
        { key: 'action', label: t('audit.action') },
        { key: 'actor', label: t('audit.actor'), render: (r) => el('span', { class: 't-mono', text: r.actor || '—' }) },
        { key: 'targetType', label: t('audit.target') },
        { key: 'targetId', label: 'ID', render: (r) => el('span', { class: 't-mono', text: r.targetId || '—' }) },
      ],
      rows, pageSize: 16, emptyText: t('audit.empty'),
    }));
  });
  return wrap;
}
export default renderAdminAudit;
