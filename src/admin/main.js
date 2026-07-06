// ============================================================
//  admin/main.js — Admin panel boot ildizi
//  Sprint-1: core infratuzilma + auth boot (fermer bilan bir xil
//  poydevor). Rol tekshiruvi (super/operator/region) va admin
//  funksiyalari -> Sprint-8. Bu yerda placeholder funksiya YO'Q —
//  faqat real boot va autentifikatsiya.
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

window.addEventListener('error', (ev) => handleError(ev.error || ev.message, 'admin.window.onerror'));
window.addEventListener('unhandledrejection', (ev) => handleError(ev.reason, 'admin.unhandledrejection'));

function bootError(err) {
  const { messageKey } = handleError(err, 'admin.boot');
  const root = document.getElementById('root') || document.body;
  mount(root, el('div', { class: 'app' }, [
    el('div', { class: 'shell' }, [el('div', { style: 'color:var(--crit);font-weight:700', text: t(messageKey) })]),
  ]));
}

function renderAdminShell({ user }) {
  return el('div', { class: 'app' }, [
    el('div', { class: 'shell' }, [
      el('div', { style: 'color:var(--primary)', html: icon('user', 40) }),
      el('div', { style: 'font-size:20px;font-weight:800', text: 'SmartLake Admin' }),
      el('div', { style: 'color:var(--ink-soft);font-size:13px', text: t('auth.loggedInAs', { email: user.email }) }),
      el('button', {
        class: 'btn', style: 'max-width:200px', text: t('common.logout'),
        onClick: async () => {
          try { await authService.signOut(); }
          catch (e) { const { messageKey } = handleError(e, 'admin.logout'); toast(t(messageKey), 'err'); }
        },
      }),
    ]),
  ]);
}

async function main() {
  let screens;
  try {
    await import('../core/firebase.js');
    setLocale(detectLocale());
    const root = document.getElementById('root');
    screens = createScreenManager(root);
    screens.register('auth', renderAuth).register('shell', renderAdminShell);
  } catch (e) {
    bootError(e);
    return;
  }

  let authMode = 'login';
  const showAuth = () => screens.show('auth', { mode: authMode, onSwitch: (m) => { authMode = m; showAuth(); } });

  authService.onChange((user) => {
    if (user) { logger.info('Admin auth: kirgan'); screens.show('shell', { user }); }
    else { logger.info('Admin auth: kirmagan'); authMode = 'login'; showAuth(); }
  });
}

main();
