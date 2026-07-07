// ============================================================
//  features/auth/views/adminSettings.js — Admin sozlamalari
// ============================================================
import { el, mount } from '../../../shared/dom.js';
import { t, getLocale, setLocale } from '../../../core/i18n/index.js';
import { mdCard, listItem, select } from '../../../shared/ui/index.js';
import { toggleTheme, getTheme } from '../../../shared/ui/theme.js';
import { LOCALES } from '../../../core/config.js';
import { authStore } from '../index.js';
import { userService } from '../../users/index.js';

export function renderAdminSettings() {
  const wrap = el('div', { style: 'max-width:560px' });
  function render() {
    const s = authStore.getState();
    const dark = getTheme() === 'dark';
    const loc = select(LOCALES.map((l) => ({ value: l, label: l.toUpperCase() })), getLocale());
    loc.addEventListener('change', async () => { setLocale(loc.value); try { if (s.uid) await userService.setLocale(s.uid, loc.value); } catch (_) {} render(); });
    const themeItem = listItem({ leading: dark ? 'moon' : 'sun', title: t('settings.darkMode'), subtitle: dark ? 'Dark' : 'Light', onClick: () => { toggleTheme(); render(); } });
    const langRow = el('div', { class: 'md-listitem' }, [el('div', { class: 'grow t-title-sm', text: t('settings.language') }), loc]);
    mount(wrap, mdCard([
      el('div', { class: 't-title', style: 'margin-bottom:8px', text: t('nav.settings') }),
      el('div', { class: 'md-list' }, [themeItem, langRow,
        listItem({ leading: 'info', title: t('settings.about'), subtitle: 'SmartLake Admin v2.0' })]),
    ], { elevated: true }));
  }
  render();
  return wrap;
}
export default renderAdminSettings;
