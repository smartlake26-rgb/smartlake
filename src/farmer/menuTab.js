// ============================================================
//  farmer/menuTab.js — MENYU tabi (DASH-V3)
//  Profil, Qurilmalar va Bildirishnomalar bottom-nav'dan shu yerga
//  ko'chdi (funksiya YO'QOLMAGAN — mavjud tab renderlariga
//  nav.switchTab orqali o'tiladi; shell TABS xaritasida ular
//  saqlanib qolgan). + Tungi rejim almashtirgichi.
//  Faqat prezentatsiya: DS komponentlari, business logic yo'q.
// ============================================================

import { el } from '../shared/dom.js';
import { t } from '../core/i18n/index.js';
import { authStore } from '../features/auth/index.js';
import {
  slCard, slListItem, ICONS, slBadge,
} from '../design-system/index.js';
import { getTheme, toggleTheme } from '../shared/ui/theme.js';
import { appBar } from '../shared/ui/index.js';

export function renderMenuTab(nav) {
  const s = authStore.getState();
  const content = el('div', { class: 'md-content' });

  // --- Foydalanuvchi sarlavha kartasi ---
  const initials = s.profile
    ? `${(s.profile.ism || '?')[0] || ''}${(s.profile.fam || '')[0] || ''}`.toUpperCase() : '·';
  const who = slCard([
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-3)' }, [
      s.profile && s.profile.photoUrl
        ? el('img', { src: s.profile.photoUrl, alt: '', class: 'md-avatar',
            style: 'width:52px;height:52px;object-fit:cover' })
        : el('div', { class: 'md-avatar', style: 'width:52px;height:52px;font-size:18px', text: initials }),
      el('div', { class: 'sl-grow' }, [
        el('div', { class: 'sl-title', text: s.profile ? `${s.profile.ism} ${s.profile.fam || ''}` : (s.email || '') }),
        el('div', { class: 'sl-body-sm sl-text-secondary', text: t('role.' + (s.role || 'farmer')) }),
      ]),
    ]),
  ], { elevated: true });

  // --- Bo'limlar ro'yxati ---
  const themeLabel = () => getTheme() === 'dark' ? '🌙' : '☀️';
  const themeBadge = slBadge({ type: 'info', label: themeLabel(), dot: false });

  const list = slCard([
    el('div', { class: 'sl-listitem-group' }, [
      slListItem({ leading: ICONS.navigation.profile, title: t('menu.profile'),
        subtitle: t('menu.profileDesc'), onClick: () => nav.switchTab('profile') }),
      slListItem({ leading: ICONS.navigation.devices, title: t('menu.devices'),
        subtitle: t('menu.devicesDesc'), onClick: () => nav.switchTab('devices') }),
      slListItem({ leading: ICONS.navigation.alerts, title: t('menu.alerts'),
        subtitle: t('menu.alertsDesc'), onClick: () => nav.switchTab('alerts') }),
      slListItem({ leading: 'moon', title: t('menu.theme'), subtitle: t('menu.themeDesc'),
        trailing: themeBadge,
        onClick: () => { toggleTheme(); themeBadge.querySelector('span:last-child').textContent = themeLabel(); } }),
    ]),
  ]);

  // --- Chiqish ---
  const logoutRow = slCard([
    slListItem({ leading: ICONS.navigation.logout, title: t('common.logout'),
      onClick: () => nav.logout && nav.logout() }),
  ]);

  content.append(
    el('div', { class: 'sl-stack' }, [who, list, logoutRow]),
  );
  return el('div', {}, [appBar({ title: t('menu.title') }), content]);
}

export default renderMenuTab;
