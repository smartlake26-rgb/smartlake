// ============================================================
//  features/commands/views/adminCommands.js — Buyruqlar (admin, realtime)
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { dataTable, pill } from '../../../shared/ui/index.js';
import * as adminStore from '../../../admin/adminStore.js';
import { commandService } from '../services/commandService.js';
import { COMMAND_STATUS } from '../../../core/collections.js';
import { COMMAND_DEFS } from '../constants/commandConstants.js';

const KIND = {
  [COMMAND_STATUS.PENDING]: 'warning', [COMMAND_STATUS.SENT]: 'primary',
  [COMMAND_STATUS.EXECUTED]: 'active', [COMMAND_STATUS.FAILED]: 'critical', [COMMAND_STATUS.EXPIRED]: 'offline',
};
function ts(v) { return v && typeof v.toDate === 'function' ? v.toDate().toLocaleString() : '—'; }

export function renderAdminCommands() {
  const wrap = el('div', {});
  let commands = [];

  function render() {
    const st = adminStore.getState();
    const rows = commands.map((c) => {
      const owner = st.users.find((u) => u.uid === c.ownerUid);
      const def = COMMAND_DEFS[c.commandType];
      return {
        deviceId: c.deviceId,
        owner: owner ? `${owner.profile?.ism || ''} ${owner.profile?.fam || ''}`.trim() || (owner.email || '—') : '—',
        command: def ? t(def.labelKey) : c.commandType,
        status: c.status,
        created: ts(c.createdAt), completed: ts(c.completedAt),
        result: c.result || '—',
      };
    });
    mount(wrap, dataTable({
      columns: [
        { key: 'deviceId', label: t('device.deviceId'), render: (r) => el('span', { class: 't-mono', text: r.deviceId }) },
        { key: 'owner', label: t('tm.owner') },
        { key: 'command', label: t('cmd.command') },
        { key: 'status', label: t('tm.status'), render: (r) => pill(t('cmdStatus.' + r.status), KIND[r.status] || 'neutral') },
        { key: 'created', label: t('audit.time'), sortable: false },
        { key: 'completed', label: t('cmd.completed'), sortable: false },
        { key: 'result', label: t('cmd.result') },
      ],
      rows, pageSize: 15, emptyText: t('cmd.noneAdmin'),
      filters: [{ key: 'status', label: t('tm.status'), options: Object.values(COMMAND_STATUS).map((s) => ({ value: s, label: t('cmdStatus.' + s) })) }],
    }));
  }

  const unsub = commandService.subscribeAll((list) => { commands = list; render(); }, () => render());
  const unsubStore = adminStore.subscribe(render);
  render();
  wrap.__cleanup = () => { unsub(); unsubStore(); };
  return wrap;
}

export default renderAdminCommands;
