// ============================================================
//  features/settings/views/settingsTab.js — SOZLAMALAR
//  Drawer'dagi "Sozlamalar" bosilganda ochiladi.
//  Ichida: Tungi rejim, Til (kelajak), Chiqish
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { authStore } from '../../auth/index.js';
import { getTheme, toggleTheme } from '../../../shared/ui/theme.js';
import { appBar } from '../../../shared/ui/index.js';
import { slIcon, slCard, slButton, slListItem, ICONS } from '../../../design-system/index.js';

export function renderSettingsTab(nav) {
  const isUz = detectLocale() === 'uz';

  /* --- Tungi rejim --- */
  const themeToggle = el('button', {
    type: 'button',
    style: 'width:48px;height:28px;border-radius:14px;border:none;cursor:pointer;position:relative;'
         + 'transition:background .2s;'
         + (getTheme() === 'dark'
           ? 'background:var(--sl-primary)'
           : 'background:var(--sl-border)'),
  });
  const themeKnob = el('span', {
    style: 'position:absolute;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;'
         + 'box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;'
         + (getTheme() === 'dark' ? 'left:23px' : 'left:3px'),
  });
  themeToggle.appendChild(themeKnob);

  function updateThemeUI() {
    const dark = getTheme() === 'dark';
    themeToggle.style.background = dark ? 'var(--sl-primary)' : 'var(--sl-border)';
    themeKnob.style.left = dark ? '23px' : '3px';
    themeIcon.innerHTML = slIcon(dark ? 'moon' : 'sun', 22);
    themeLabel.textContent = dark
      ? (isUz ? 'Tungi rejim yoqilgan' : 'Тёмный режим включён')
      : (isUz ? 'Kunduzgi rejim' : 'Светлый режим');
  }

  const themeIcon = el('span', {
    style: 'display:inline-flex;color:var(--sl-primary);flex:none',
    html: slIcon(getTheme() === 'dark' ? 'moon' : 'sun', 22),
  });
  const themeLabel = el('span', {
    style: 'font-size:14px;font-weight:600',
    text: getTheme() === 'dark'
      ? (isUz ? 'Tungi rejim yoqilgan' : 'Тёмный режим включён')
      : (isUz ? 'Kunduzgi rejim' : 'Светлый режим'),
  });

  themeToggle.addEventListener('click', () => {
    toggleTheme();
    updateThemeUI();
  });

  const themeRow = el('div', {
    style: 'display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--sl-divider)',
  }, [themeIcon, el('div', { class: 'sl-grow' }, [themeLabel]), themeToggle]);

  /* --- Ilova haqida --- */
  const aboutRow = el('div', {
    style: 'display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--sl-divider)',
  }, [
    el('span', { style: 'display:inline-flex;color:var(--sl-text-secondary);flex:none', html: slIcon('info', 22) }),
    el('div', { class: 'sl-grow' }, [
      el('div', { style: 'font-size:14px;font-weight:600', text: isUz ? 'Ilova haqida' : 'О приложении' }),
      el('div', { style: 'font-size:12px;color:var(--sl-text-secondary)', text: 'SmartLake v2.0' }),
    ]),
  ]);

  /* --- Chiqish --- */
  const logoutBtn = slButton({
    label: isUz ? 'Tizimdan chiqish' : 'Выйти из системы',
    variant: 'outlined',
    icon: 'logout',
    onClick: () => {
      const ok = confirm(t('settings.logoutConfirm'));
      if (ok && nav.logout) nav.logout();
    },
  });
  logoutBtn.style.width = '100%';
  logoutBtn.style.marginTop = '16px';
  logoutBtn.style.color = 'var(--sl-critical)';
  logoutBtn.style.borderColor = 'var(--sl-critical)';

  const content = el('div', { class: 'md-content' }, [
    slCard([
      el('div', { class: 'sl-card-title', style: 'margin-bottom:12px',
        text: isUz ? 'Sozlamalar' : 'Настройки' }),
      themeRow,
      aboutRow,
      logoutBtn,
    ]),
  ]);

  const node = el('div', {}, [
    appBar({ title: isUz ? 'Sozlamalar' : 'Настройки' }),
    content,
  ]);
  return node;
}

export default renderSettingsTab;
