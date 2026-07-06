// ============================================================
//  farmer/main.js — Fermer ilovasi boot ildizi
//  Feature'larni ulaydi: env -> firebase -> global xato tutuvchilar
//  -> i18n -> auth holati bo'yicha ekran.
//  Sprint-1: login/register + minimal authenticated shell.
//  To'liq dashboard -> Sprint-4.
// ============================================================

import '../shared/base.css';

import { el, mount } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { toast } from '../shared/toast.js';
import { createScreenManager } from '../shared/screen.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';
import { t, detectLocale, setLocale } from '../core/i18n/index.js';
import { authService, renderAuth } from '../features/auth/index.js';

// --- Global xato tutuvchilar: hech qanday xato jimgina yo'qolmaydi ---
window.addEventListener('error', (ev) => {
  handleError(ev.error || ev.message, 'window.onerror');
});
window.addEventListener('unhandledrejection', (ev) => {
  handleError(ev.reason, 'unhandledrejection');
});

function bootError(err) {
  const { messageKey } = handleError(err, 'boot');
  const root = document.getElementById('root') || document.body;
  mount(root, el('div', { class: 'app' }, [
    el('div', { class: 'shell' }, [
      el('div', { style: 'color:var(--crit);font-weight:700', text: t(messageKey) }),
    ]),
  ]));
}

/** Kirilgandan keyingi minimal shell (Sprint-1). Sprint-4'da dashboard bo'ladi. */
function renderShell({ user }) {
  return el('div', { class: 'app' }, [
    el('div', { class: 'shell' }, [
      el('div', { style: 'color:var(--primary)', html: icon('waves', 40) }),
      el('div', { style: 'font-size:20px;font-weight:800', text: `${t('common.welcome')}!` }),
      el('div', { style: 'color:var(--ink-soft);font-size:13px', text: t('auth.loggedInAs', { email: user.email }) }),
      el('button', {
        class: 'btn', style: 'max-width:200px', text: t('common.logout'),
        onClick: async () => {
          try { await authService.signOut(); }
          catch (e) { const { messageKey } = handleError(e, 'shell.logout'); toast(t(messageKey), 'err'); }
        },
      }),
    ]),
  ]);
}

async function main() {
  // Firebase init (assertEnv ichkarida ishlaydi; ConfigError -> bootError).
  let screens;
  try {
    // Dinamik import: firebase.js modul yuklanganda env tekshiruvi bajariladi.
    await import('../core/firebase.js');
    setLocale(detectLocale());
    const root = document.getElementById('root');
    screens = createScreenManager(root);
    screens
      .register('auth', renderAuth)
      .register('shell', renderShell);
  } catch (e) {
    bootError(e);
    return;
  }

  let authMode = 'login';
  const showAuth = () => screens.show('auth', {
    mode: authMode,
    onSwitch: (m) => { authMode = m; showAuth(); },
  });

  authService.onChange((user) => {
    if (user) {
      logger.info('Auth: kirgan holat');
      screens.show('shell', { user });
    } else {
      logger.info('Auth: kirmagan holat');
      authMode = 'login';
      showAuth();
    }
  });
}

main();
