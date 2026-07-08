// ============================================================
//  features/commands/views/commandPanel.js — Buyruq boshqaruvi (fermer)
//  Aerator/Auto/Feed/System tugmalari + oxirgi buyruq statusi (realtime).
//  Firmware Sprint-9'gacha buyruq `pending`da turadi (real, placeholder emas).
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { handleError } from '../../../core/errors.js';
import { mdCard, mdButton } from '../../../shared/ui/index.js';
import { COMMAND_TYPES, COMMAND_STATUS } from '../../../core/collections.js';
import { commandService } from '../services/commandService.js';
import { COMMAND_DEFS, COMMAND_TTL_MS } from '../constants/commandConstants.js';
import { isExpired } from '../domain/commandLifecycle.js';

const CMD_COLOR = {
  [COMMAND_STATUS.PENDING]: 'var(--md-warning)',
  [COMMAND_STATUS.SENT]: 'var(--md-primary)',
  [COMMAND_STATUS.EXECUTED]: 'var(--md-success)',
  [COMMAND_STATUS.FAILED]: 'var(--md-critical)',
  [COMMAND_STATUS.EXPIRED]: 'var(--md-neutral)',
};

function cmdChip(status) {
  const c = CMD_COLOR[status] || 'var(--md-neutral)';
  return el('span', { class: 'md-chip', style: `background:color-mix(in srgb, ${c} 16%, transparent);color:${c}`, text: t('cmdStatus.' + status) });
}

const GROUPS = [
  { key: 'aerator', types: [COMMAND_TYPES.AERATOR_ON, COMMAND_TYPES.AERATOR_OFF] },
  { key: 'auto', types: [COMMAND_TYPES.AUTO_ON, COMMAND_TYPES.AUTO_OFF] },
  { key: 'feed', types: [COMMAND_TYPES.FEED_START, COMMAND_TYPES.FEED_STOP] },
  { key: 'system', types: [COMMAND_TYPES.RESTART, COMMAND_TYPES.SYNC_TIME, COMMAND_TYPES.REQUEST_STATUS] },
];

export function renderCommandPanel(deviceId, ownerUid) {
  const listEl = el('div', { class: 'stack-2' });
  let commands = [];
  let sending = false;

  const buttons = [];
  function setDisabled(v) { buttons.forEach((b) => { b.disabled = v; }); }

  async function send(type) {
    if (sending) return;
    sending = true; setDisabled(true);
    try {
      await commandService.createCommand({ deviceId, commandType: type, payload: null }, ownerUid);
      toast(t('cmd.sent'), 'ok');
    } catch (e) {
      toast(t(handleError(e, 'command.create').messageKey), 'err');
    } finally { sending = false; setDisabled(false); }
  }

  const groupRows = GROUPS.map((g) => el('div', {}, [
    el('div', { class: 't-label muted', style: 'margin:6px 0 4px', text: t('cmdGroup.' + g.key) }),
    el('div', { class: 'row', style: 'gap:8px;flex-wrap:wrap' }, g.types.map((type) => {
      const def = COMMAND_DEFS[type];
      const variant = type.endsWith('_off') || type.endsWith('_stop') ? 'outlined' : (type === COMMAND_TYPES.RESTART ? 'danger' : 'tonal');
      const b = mdButton({ label: t(def.labelKey), icon: def.icon, variant, onClick: () => send(type) });
      buttons.push(b);
      return b;
    })),
  ]));

  function renderList() {
    if (!commands.length) { mount(listEl, el('div', { class: 't-body-sm muted', text: t('cmd.none') })); return; }
    mount(listEl, ...commands.slice(0, 5).map((c) => {
      const createdMs = c.createdAt && typeof c.createdAt.toMillis === 'function' ? c.createdAt.toMillis() : null;
      const visualExpired = isExpired(createdMs, c.status, Date.now(), COMMAND_TTL_MS);
      const status = visualExpired ? COMMAND_STATUS.EXPIRED : c.status;
      const def = COMMAND_DEFS[c.commandType] || { labelKey: 'cmd.unknown' };
      return el('div', { class: 'row-between', style: 'padding:6px 0;border-bottom:1px solid var(--md-outline-variant)' }, [
        el('div', { class: 'row', style: 'gap:8px' }, [
          el('span', { style: 'color:var(--md-on-surface-variant)', html: icon(def.icon || 'activity', 18) }),
          el('span', { class: 't-body-sm', text: t(def.labelKey) }),
        ]),
        cmdChip(status),
      ]);
    }));
  }

  const unsub = commandService.subscribeByDevice(deviceId, (list) => { commands = list; renderList(); }, () => renderList());
  renderList();

  const card = mdCard([
    el('div', { class: 't-title-sm', style: 'margin-bottom:4px', text: t('cmd.control') }),
    ...groupRows,
    el('div', { class: 't-label muted', style: 'margin:12px 0 4px', text: t('cmd.recent') }),
    listEl,
  ], { elevated: true });
  card.__cleanup = unsub;
  return card;
}

export default renderCommandPanel;
