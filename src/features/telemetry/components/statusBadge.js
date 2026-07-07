// ============================================================
//  components/statusBadge.js — Smart-status rangli belgisi (qayta ishlatiladi)
// ============================================================

import { el } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';

const COLOR = {
  [DEVICE_STATUS.HEALTHY]: 'var(--ok)',
  [DEVICE_STATUS.GOOD]: 'var(--ok)',
  [DEVICE_STATUS.WARNING]: 'var(--warn)',
  [DEVICE_STATUS.CRITICAL]: 'var(--crit)',
  [DEVICE_STATUS.OFFLINE]: 'var(--ink-soft)',
  [DEVICE_STATUS.UNKNOWN]: 'var(--ink-soft)',
};

export function statusBadge(status) {
  const color = COLOR[status] || 'var(--ink-soft)';
  return el('span', {
    class: 'status-badge',
    style: `color:${color};border-color:${color}`,
    text: t('tm.status_' + status),
  });
}

export default statusBadge;
