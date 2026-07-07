// ============================================================
//  admin/main.js — Admin panel boot ildizi (Sprint-3)
//  Yagona Firebase Auth; rol users/{uid}.role dan.
//  Guard: faqat admin rollari (operator/region/super) kiradi.
//  Admin FUNKSIYALARI -> Sprint-8. Bu yerda placeholder yo'q —
//  real auth + rol guard + minimal admin shell.
// ============================================================

import '../shared/base.css';

import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { createRouter } from '../shared/router.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';
import { t, detectLocale, setLocale } from '../core/i18n/index.js';
import {
  authService, authStore, access,
  renderAuth, renderSettings,
  AUTH_SCREENS, ROUTES, ADMIN_ROLES,
} from '../features/auth/index.js';
import { renderPendingRequests } from '../features/ownership/index.js';

window.addEventListener('error', (ev) => handleError(ev.error || ev.message, 'admin.window.onerror'));
window.addEventListener('unhandledrejection', (ev) => handleError(ev.reason, 'admin.unhandledrejection'));

function screen(children) { return el('div', { class: 'app' }, [el('div', { class: 'shell' }, children)]); }

function loadingScreen() { return screen([el('div', { text: t('app.loading') })]); }

function deniedScreen() {
  return screen([
    el('div', { class: 'banner err', text: t('home.noAdminAccess') }),
    el('button', { class: 'btn', style: 'max-width:200px', text: t('common.logout'), onClick: () => authService.signOut() }),
  ]);
}

function adminHome({ router }) {
  const s = authStore.getState();
  return screen([
    el('div', { style: 'color:var(--primary)', html: icon('user', 40) }),
    el('div', { style: 'font-size:20px;font-weight:800', text: 'SmartLake Admin' }),
    el('span', { class: 'role-badge', text: t('role.' + s.role) }),
    el('div', { style: 'color:var(--ink-soft);font-size:13px', text: t('auth.loggedInAs', { email: s.email }) }),
    el('div', { class: 'home-actions' }, [
      el('button', { class: 'btn', text: t('device.pendingTitle'), onClick: () => router.go(ROUTES.REQUESTS) }),
      el('button', { class: 'btn ghost', text: t('home.settings'), onClick: () => router.go(ROUTES.SETTINGS) }),
    ]),
  ]);
}

async function main() {
  const root = document.getElementById('root');
  try {
    await import('../core/firebase.js');
    setLocale(detectLocale());
  } catch (e) {
    const { messageKey } = handleError(e, 'admin.boot');
    root.replaceChildren(screen([el('div', { style: 'color:var(--crit);font-weight:700', text: t(messageKey) })]));
    return;
  }

  const router = createRouter(root);
  let authMode = AUTH_SCREENS.LOGIN;
  const goAuth = () => router.go(ROUTES.AUTH);

  router
    .define(ROUTES.AUTH, () => renderAuth({ mode: authMode, onSwitch: (m) => { authMode = m; goAuth(); } }))
    .define(ROUTES.HOME, () => adminHome({ router }))
    .define(ROUTES.REQUESTS, () => renderPendingRequests({ onBack: () => router.go(ROUTES.HOME) }))
    .define(ROUTES.SETTINGS, () => renderSettings({ onBack: () => router.go(ROUTES.HOME), onRerender: () => router.go(ROUTES.SETTINGS) }));

  root.replaceChildren(loadingScreen());

  let authPhase = null;
  authStore.subscribe((s) => {
    if (s.loading) return;
    const next = !s.firebaseUser ? 'auth'
      : !access.canAccess(s.userDoc, ADMIN_ROLES) ? 'denied'
        : 'app';
    if (next === authPhase) return;
    authPhase = next;
    if (next === 'auth') { authMode = AUTH_SCREENS.LOGIN; goAuth(); }
    else if (next === 'denied') root.replaceChildren(deniedScreen());
    else if (router.current() === ROUTES.AUTH || router.current() === null) router.go(ROUTES.HOME);
  });

  authStore.initAuthStore();
  logger.info('Admin panel ishga tushdi');
}

main();
