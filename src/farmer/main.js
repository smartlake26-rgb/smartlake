// ============================================================
//  farmer/main.js — Fermer ilovasi boot ildizi (Sprint-3)
//  Router + authStore + himoyalangan yo'nalishlar.
//  Auto-login (Firebase sessiya) -> rol/status yuklanadi -> yo'nalish.
//  To'liq dashboard (ko'llar/monitoring) -> Sprint-4.
// ============================================================

import '../shared/base.css';

import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { toast } from '../shared/toast.js';
import { createRouter } from '../shared/router.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';
import { t, detectLocale, setLocale } from '../core/i18n/index.js';
import {
  authService, authStore, access,
  renderAuth, renderProfile, renderSettings,
  AUTH_SCREENS, ROUTES,
} from '../features/auth/index.js';
import { renderClaim } from '../features/devices/index.js';

window.addEventListener('error', (ev) => handleError(ev.error || ev.message, 'window.onerror'));
window.addEventListener('unhandledrejection', (ev) => handleError(ev.reason, 'unhandledrejection'));

function loadingScreen() {
  return el('div', { class: 'app' }, [el('div', { class: 'shell' }, [el('div', { text: t('app.loading') })])]);
}

function bootError(err) {
  const { messageKey } = handleError(err, 'boot');
  return el('div', { class: 'app' }, [el('div', { class: 'shell' }, [el('div', { style: 'color:var(--crit);font-weight:700', text: t(messageKey) })])]);
}

function blockedScreen(messageKey) {
  return el('div', { class: 'app' }, [
    el('div', { class: 'shell' }, [
      el('div', { class: 'banner err', text: t(messageKey) }),
      el('button', { class: 'btn', style: 'max-width:200px', text: t('common.logout'), onClick: () => authService.signOut() }),
    ]),
  ]);
}

function homeScreen({ router }) {
  const s = authStore.getState();
  const children = [];
  if (!s.emailVerified) children.push(el('div', { class: 'banner', text: t('home.verifyBanner') }));
  children.push(
    el('div', { style: 'color:var(--primary)', html: icon('waves', 40) }),
    el('div', { style: 'font-size:20px;font-weight:800', text: `${t('common.welcome')}, ${s.profile ? s.profile.ism : ''}!` }),
    el('span', { class: 'role-badge', text: t('role.' + (s.role || 'farmer')) }),
    el('div', { class: 'home-actions' }, [
      el('button', { class: 'btn', text: t('device.claimTitle'), onClick: () => router.go(ROUTES.CLAIM) }),
      el('button', { class: 'btn ghost', text: t('home.profile'), onClick: () => router.go(ROUTES.PROFILE) }),
      el('button', { class: 'btn ghost', text: t('home.settings'), onClick: () => router.go(ROUTES.SETTINGS) }),
    ]),
  );
  return el('div', { class: 'app' }, [el('div', { class: 'shell' }, children)]);
}

async function main() {
  const root = document.getElementById('root');
  try {
    await import('../core/firebase.js');
    setLocale(detectLocale());
  } catch (e) {
    root.replaceChildren(bootError(e));
    return;
  }

  const router = createRouter(root);
  let authMode = AUTH_SCREENS.LOGIN;

  const goAuth = () => router.go(ROUTES.AUTH);
  router
    .define(ROUTES.AUTH, () => renderAuth({
      mode: authMode,
      onSwitch: (m) => { authMode = m; goAuth(); },
    }))
    .define(ROUTES.HOME, () => homeScreen({ router }))
    .define(ROUTES.PROFILE, () => renderProfile({ onBack: () => router.go(ROUTES.HOME) }))
    .define(ROUTES.CLAIM, () => renderClaim({ onBack: () => router.go(ROUTES.HOME) }))
    .define(ROUTES.SETTINGS, () => renderSettings({
      onBack: () => router.go(ROUTES.HOME),
      onRerender: () => router.go(ROUTES.SETTINGS),
    }));

  root.replaceChildren(loadingScreen());

  authStore.subscribe((s) => {
    if (s.loading) return;                                  // hal bo'lguncha kutamiz
    if (!s.firebaseUser) { authMode = AUTH_SCREENS.LOGIN; goAuth(); return; }
    if (!s.userDoc || !s.role) { root.replaceChildren(blockedScreen('home.suspended')); return; }
    if (s.status !== 'active') { root.replaceChildren(blockedScreen('home.suspended')); return; }
    // Kirgan + aktiv: joriy route auth bo'lsa home'ga o't.
    if (router.current() === ROUTES.AUTH || router.current() === null) router.go(ROUTES.HOME);
    else router.go(router.current());                       // ma'lumot yangilanganda qayta render
  });

  authStore.initAuthStore();
  logger.info('Fermer ilovasi ishga tushdi');
}

main();
