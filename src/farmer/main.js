// ============================================================
//  farmer/main.js — Fermer ilovasi boot ildizi (Sprint-5.5 MD3)
//  Theme + Firebase + authStore (faza-asosli) -> Auth ekrani yoki
//  Bottom-nav Shell. dataStore ilovaga bitta telemetriya listeneri beradi.
// ============================================================

import '../shared/ui/tokens.css';
import '../shared/ui/ui.css';
import '../design-system/index.css';   // DS 3.0 (sl-*) — mavjud md-* bilan to'qnashmaydi
import '../core/firebase.js';

import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';
import { t, detectLocale, setLocale } from '../core/i18n/index.js';
import { initTheme } from '../shared/ui/theme.js';
import { mdButton, loader } from '../shared/ui/index.js';
import { authService, authStore, renderAuth, AUTH_SCREENS } from '../features/auth/index.js';
import * as dataStore from './dataStore.js';
import { startArchiver } from '../features/telemetry/services/archiveService.js';
import { createShell } from './shell.js';

window.addEventListener('error', (ev) => handleError(ev.error || ev.message, 'window.onerror'));
window.addEventListener('unhandledrejection', (ev) => handleError(ev.reason, 'unhandledrejection'));

function loadingScreen() {
  return el('div', { class: 'md-app' }, [
    el('div', { style: 'min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px' }, [
      el('div', { style: 'color:var(--md-primary)', html: icon('waves', 44) }),
      loader(30),
    ]),
  ]);
}

function blockedScreen(messageKey, onLogout) {
  return el('div', { class: 'md-app' }, [
    el('div', { class: 'md-content no-nav', style: 'min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px' }, [
      el('div', { style: 'color:var(--md-warning)', html: icon('lock', 44) }),
      el('div', { class: 't-title', text: t(messageKey) }),
      el('div', { class: 't-body-sm muted', text: t('home.contactAdmin') }),
      el('div', { style: 'margin-top:8px' }, [mdButton({ label: t('common.logout'), variant: 'tonal', onClick: onLogout })]),
    ]),
  ]);
}

function main() {
  // Dasturni yangilashda keshni tozalash mexanizmi
  const CURRENT_VERSION = '2.0.7';
  const savedVersion = localStorage.getItem('smartlake_version');
  if (savedVersion !== CURRENT_VERSION) {
    localStorage.setItem('smartlake_version', CURRENT_VERSION);
    if ('caches' in window) {
      caches.keys().then((names) => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then((registrations) => {
            return Promise.all(registrations.map(r => r.unregister()));
          }).then(() => {
            window.location.reload(true);
          });
        } else {
          window.location.reload(true);
        }
      });
      return; // Yangilanish vaqtida ishga tushishni to'xtatib turamiz
    }
  }

  const root = document.getElementById('app') || document.getElementById('root') || document.body;
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
      : (!s.userDoc || !s.role || s.status !== 'active') ? 'blocked'
        : 'app';
    if (next === phase) return;
    phase = next;
    if (shell) { shell.destroy(); shell = null; }
    if (next === 'auth') { dataStore.stop(); authMode = AUTH_SCREENS.LOGIN; renderAuthScreen(); }
    else if (next === 'blocked') { dataStore.stop(); root.replaceChildren(blockedScreen('home.suspended', logout)); }
    else {
      dataStore.start(s.uid); startArchiver(dataStore, s.uid); shell = createShell(root, { onLogout: logout });
      // Push bildirishnomalar — foydalanuvchi kirganidan keyin init
      import('../core/pushService.js').then(({ pushService }) => pushService.init(s.uid)).catch(() => {});
    }
  });

  root.replaceChildren(loadingScreen());
  authStore.initAuthStore();
  logger.info('Fermer ilovasi ishga tushdi (MD3)');

  // Service Worker ro'yxatdan o'tkazish va yangilanishlarni nazorat qilish
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          logger.info('Service Worker muvaffaqiyatli ro\'yxatdan o\'tdi:', reg.scope);
          
          // Yangi versiya topilganda uni yuklash
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    logger.info('Yangi yangilanish aniqlandi. Sahifa yangilanmoqda...');
                    window.location.reload();
                  }
                }
              };
            }
          };
        })
        .catch((err) => logger.warn('Service Worker ro\'yxatdan o\'tishda xatolik:', err));
    });
  }
}

main();
