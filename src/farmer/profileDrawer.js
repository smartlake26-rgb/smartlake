// ============================================================
//  farmer/profileDrawer.js — PROFIL DRAWER (chap yuqori burchak)
//  Avatar tugmasi bosilganda o'ngdan chiquvchi panel:
//    - Ustida: katta avatar + ism + email + rol
//    - Menyu qatorlari: Profil, Qurilmalar, Bildirishnomalar, Tema
//    - Pastda: Chiqish
//  Bottom-nav'dan "Menyu" tab'i olib tashlandi — bu drawer uning
//  vazifasini to'liq o'z zimmasiga oladi.
//  Animatsiya: scrim + drawer-in/out, ESC va tashqarini bosish yopadi.
// ============================================================

import { el } from '../shared/dom.js';
import { t } from '../core/i18n/index.js';
import { authStore } from '../features/auth/index.js';
import { getTheme, toggleTheme } from '../shared/ui/theme.js';
import { slIcon, ICONS, slListItem } from '../design-system/index.js';

/**
 * @param {object} nav  — shell nav ob'ekti
 * @returns {HTMLButtonElement}  avatar tugmasi (header'ga qo'yiladi)
 */
export function createProfileDrawer(nav) {
  const s = authStore.getState();

  /* ---------- Avatar tugmasi ---------- */
  const initials = s.profile
    ? `${(s.profile.ism || '?')[0] || ''}${(s.profile.fam || '')[0] || ''}`.toUpperCase()
    : '?';

  const avatarBtn = el('button', {
    class: 'sl-avatar-btn',
    type: 'button',
    'aria-label': t('menu.title'),
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
  });
  if (s.profile && s.profile.photoUrl) {
    avatarBtn.appendChild(el('img', { src: s.profile.photoUrl, alt: '' }));
  } else {
    avatarBtn.textContent = initials;
  }

  /* ---------- Drawer qurish ---------- */
  let drawerEl = null; let scrimEl = null;

  function closeDrawer(fast = false) {
    if (!drawerEl) return;
    avatarBtn.setAttribute('aria-expanded', 'false');
    if (fast) {
      drawerEl.remove(); scrimEl.remove(); drawerEl = null; scrimEl = null;
      return;
    }
    drawerEl.classList.add('sl-pdrawer-close');
    scrimEl.style.opacity = '0'; scrimEl.style.transition = 'opacity var(--sl-motion) var(--sl-ease)';
    setTimeout(() => { drawerEl && drawerEl.remove(); scrimEl && scrimEl.remove(); drawerEl = null; scrimEl = null; }, 300);
  }

  function goto(tabId) {
    closeDrawer(true);
    nav.switchTab(tabId);
  }

  function openDrawer() {
    if (drawerEl) return;
    avatarBtn.setAttribute('aria-expanded', 'true');

    /* --- Bosh qism: katta avatar + ism + rol --- */
    const bigAvatar = el('div', { class: 'sl-pdrawer-avatar' });
    if (s.profile && s.profile.photoUrl) {
      bigAvatar.appendChild(el('img', { src: s.profile.photoUrl, alt: '' }));
    } else {
      bigAvatar.textContent = initials;
    }
    const head = el('div', { class: 'sl-pdrawer-head' }, [
      bigAvatar,
      el('div', { class: 'sl-title', text: s.profile ? `${s.profile.ism || ''} ${s.profile.fam || ''}`.trim() : (s.email || '') }),
      el('div', { class: 'sl-body-sm sl-text-secondary', style: 'margin-top:2px', text: s.email || '' }),
      el('div', { style: 'margin-top:4px' }, [
        el('span', {
          style: 'display:inline-block;padding:2px 10px;border-radius:var(--sl-r-full);' +
            'background:color-mix(in srgb,var(--sl-primary) 12%,transparent);' +
            'color:var(--sl-primary);font-size:var(--sl-fs-caption);font-weight:700',
          text: t('role.' + (s.role || 'farmer')),
        }),
      ]),
    ]);

    /* --- Menyu qatorlari --- */
    const menuBody = el('div', { class: 'sl-pdrawer-body' }, [
      slListItem({ leading: ICONS.navigation.profile, title: t('menu.profile'),
        subtitle: t('menu.profileSub'),
        onClick: () => goto('profile') }),
      slListItem({ leading: ICONS.navigation.devices, title: t('menu.devices'),
        subtitle: t('menu.devicesDesc'),
        onClick: () => goto('devices') }),
      slListItem({ leading: 'settings', title: t('menu.settings'),
        subtitle: t('menu.settingsDesc'),
        onClick: () => goto('settings') }),
      slListItem({ leading: ICONS.navigation.alerts, title: t('menu.alerts'),
        subtitle: t('menu.alertsDesc'),
        onClick: () => goto('alerts') }),
    ]);

    /* --- Yig'ish (Chiqish va Tungi rejim olib tashlandi — Sozlamalar ichida) --- */
    drawerEl = el('div', {
      class: 'sl-pdrawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('menu.title'),
    }, [head, menuBody]);

    scrimEl = el('div', { class: 'sl-pdrawer-scrim', 'aria-hidden': 'true' });
    scrimEl.addEventListener('click', () => closeDrawer());

    document.body.appendChild(scrimEl);
    document.body.appendChild(drawerEl);

    /* Focus-trap: drawer ichiga fokus kiradi */
    const firstFocusable = drawerEl.querySelector('button, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();

    /* ESC bilan yopish */
    const onKey = (e) => { if (e.key === 'Escape') { closeDrawer(); document.removeEventListener('keydown', onKey); } };
    document.addEventListener('keydown', onKey);
  }

  avatarBtn.addEventListener('click', () => drawerEl ? closeDrawer() : openDrawer());
  return avatarBtn;
}

export default createProfileDrawer;
