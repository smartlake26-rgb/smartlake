// ============================================================
//  components/offlineBanner.js — Internet uzilganda banner
// ============================================================

import { el } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';

export function offlineBanner() {
  return el('div', { class: 'banner err', text: t('tm.offlineBanner') });
}

export default offlineBanner;
