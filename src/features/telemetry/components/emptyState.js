// ============================================================
//  components/emptyState.js — Bo'sh holat (professional empty state)
// ============================================================

import { el } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { t } from '../../../core/i18n/index.js';

export function emptyState(messageKey) {
  return el('div', { class: 'empty-state' }, [
    el('div', { style: 'color:var(--ink-soft)', html: icon('droplet', 40) }),
    el('div', { style: 'color:var(--ink-soft);margin-top:8px', text: t(messageKey) }),
  ]);
}

export default emptyState;
