// ============================================================
//  admin/main.js — Admin Web Dashboard boot (Sprint-6.5)
//  MD3 + tiklangan desktop layout. Rol guard (operator/region/super).
//  adminStore -> faqat-o'qish admin so'rovlari + realtime.
// ============================================================

import '../shared/ui/tokens.css';
import '../shared/ui/ui.css';
import '../shared/ui/admin.css';
import '../core/firebase.js';

import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';
import { t, detectLocale, setLocale } from '../core/i18n/index.js';
import { initTheme } from '../shared/ui/theme.js';
import { mdButton, loader } from '../shared/ui/index.js';
import { authService, authStore, access, renderAuth, AUTH_SCREENS, ADMIN_ROLES } from '../features/auth/index.js';
import * as adminStore from './adminStore.js';
import { createAdminShell } from './shell.js';

window.addEventListener('error', (ev) => handleError(ev.error || ev.message, 'admin.window.onerror'));
window.addEventListener('unhandledrejection', (ev) => handleError(ev.reason, 'admin.unhandledrejection'));

function centered(children) {
  return el('div', { style: 'min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--md-surface)' }, children);
}
function loadingScreen() {
  return centered([el('div', { style: 'color:var(--md-primary)', html: icon('waves', 44) }), loader(30)]);
}
function deniedScreen(logout) {
  return centered([
    el('div', { style: 'color:var(--md-warning)', html: icon('lock', 44) }),
    el('div', { class: 't-title', text: t('home.noAdminAccess') }),
    mdButton({ label: t('common.logout'), variant: 'tonal', onClick: logout }),
  ]);
}

function main() {
  const root = document.getElementById('root');
  initTheme();
  setLocale(detectLocale());

  let authMode = AUTH_SCREENS.LOGIN;
  let shell = null;
  let phase = null;
  const logout = () => authService.signOut();

  function renderAuthScreen() {
    root.replaceChildren(renderAuth({ mode: authMode, onSwitch: (m) => { authMode = m; renderAuthScreen(); } }));
  }

  authStore.subscribe((s) => {
    if (s.loading) return;
    const next = !s.firebaseUser ? 'auth'
      : !access.canAccess(s.userDoc, ADMIN_ROLES) ? 'denied'
        : 'app';
    if (next === phase) return;
    phase = next;
    if (shell) { shell.destroy(); shell = null; }
    if (next === 'auth') { adminStore.stop(); authMode = AUTH_SCREENS.LOGIN; renderAuthScreen(); }
    else if (next === 'denied') { adminStore.stop(); root.replaceChildren(deniedScreen(logout)); }
    else { adminStore.start(s.userDoc || { role: s.role }); shell = createAdminShell(root, { onLogout: logout }); }
  });

  root.replaceChildren(loadingScreen());
  authStore.initAuthStore();
  logger.info('Admin Web Dashboard ishga tushdi (MD3)');
}

main();
