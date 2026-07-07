// ============================================================
//  admin/shell.js — Admin Web Dashboard qobig'i (Desktop)
//  Eski admin layouti tiklandi: sidebar + topbar + content.
//  Rol-gated nav. Bo'lim almashganda listener cleanup.
// ============================================================

import { el } from '../shared/dom.js';
import { icon } from '../shared/icons.js';
import { t } from '../core/i18n/index.js';
import { mdIconButton } from '../shared/ui/index.js';
import { toggleTheme } from '../shared/ui/theme.js';
import { authStore } from '../features/auth/index.js';
import * as adminStore from './adminStore.js';

import { renderAdminDashboard } from '../features/telemetry/views/adminDashboard.js';
import { renderAdminDevices } from '../features/devices/views/adminDevices.js';
import { renderAdminMonitoring } from '../features/telemetry/views/adminMonitoring.js';
import { renderAdminLakes } from '../features/lakes/views/adminLakes.js';
import { renderAdminUsers } from '../features/users/views/adminUsers.js';
import { renderAdminApprovals } from '../features/ownership/views/adminApprovals.js';
import { renderAdminAlerts } from '../features/telemetry/views/adminAlerts.js';
import { renderAdminAudit } from '../features/audit/views/adminAudit.js';
import { renderAdminSettings } from '../features/auth/views/adminSettings.js';

const SECTIONS = [
  { id: 'dashboard', name: 'nav.dashboard', ic: 'home', roles: ['super', 'operator', 'region'], render: renderAdminDashboard },
  { id: 'devices', name: 'nav.devices', ic: 'chip', roles: ['super', 'operator', 'region'], render: renderAdminDevices },
  { id: 'monitoring', name: 'nav.monitoring', ic: 'activity', roles: ['super', 'operator', 'region'], render: renderAdminMonitoring },
  { id: 'lakes', name: 'nav.lakes', ic: 'droplet', roles: ['super', 'operator', 'region'], render: renderAdminLakes },
  { id: 'users', name: 'nav.users', ic: 'user', roles: ['super', 'operator', 'region'], render: renderAdminUsers },
  { id: 'approvals', name: 'nav.approvals', ic: 'check', roles: ['super', 'operator', 'region'], render: renderAdminApprovals },
  { id: 'alerts', name: 'nav.alerts', ic: 'bell', roles: ['super', 'operator', 'region'], render: renderAdminAlerts },
  { id: 'audit', name: 'nav.audit', ic: 'info', roles: ['super'], render: renderAdminAudit },
  { id: 'settings', name: 'nav.settings', ic: 'settings', roles: ['super'], render: renderAdminSettings },
];

export function createAdminShell(root, ctx = {}) {
  const s = authStore.getState();
  const role = s.role || 'operator';
  const allowed = SECTIONS.filter((x) => x.roles.includes(role));
  let active = allowed[0] ? allowed[0].id : 'dashboard';
  let cleanup = null;

  const contentEl = el('div', { class: 'admin-body' });
  const titleEl = el('div', { class: 'page-title', text: '' });
  const sideEl = el('aside', { class: 'admin-side' });
  const badgeCount = () => adminStore.getState().requests.length;

  function buildNav() {
    const navBtns = allowed.map((sec) => {
      const b = el('button', { class: active === sec.id ? 'on' : '', html: icon(sec.ic, 19) + `<span>${t(sec.name)}</span>` });
      if (sec.id === 'approvals' && badgeCount() > 0) b.appendChild(el('span', { class: 'badge', text: String(badgeCount()) }));
      b.addEventListener('click', () => { active = sec.id; sideEl.classList.remove('open'); renderSection(); buildNav(); });
      return b;
    });
    sideEl.replaceChildren(
      el('div', { class: 'admin-brand' }, [
        el('div', { style: 'color:var(--side-active)', html: icon('waves', 26) }),
        el('div', {}, [el('div', { class: 'nm', html: 'Smart<span>Lake</span>' }), el('div', { class: 'tg', text: 'ADMIN' })]),
      ]),
      el('nav', { class: 'admin-nav' }, navBtns),
      el('div', { class: 'side-user' }, [
        el('div', { class: 'nm', text: s.profile ? `${s.profile.ism} ${s.profile.fam}` : (s.email || '') }),
        el('div', { class: 'role', text: t('role.' + role) }),
        el('button', { text: t('common.logout'), onClick: ctx.onLogout }),
      ]),
    );
  }

  function renderSection() {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (_) { /* ignore */ } cleanup = null; }
    const sec = allowed.find((x) => x.id === active) || allowed[0];
    titleEl.textContent = t(sec.name);
    const node = sec.render();
    cleanup = (node && typeof node.__cleanup === 'function') ? node.__cleanup : null;
    contentEl.replaceChildren(node);
    contentEl.scrollTop = 0;
  }

  const menuBtn = mdIconButton({ icon: 'chip', onClick: () => sideEl.classList.toggle('open') });
  menuBtn.classList.add('admin-menu-btn');

  const shell = el('div', { class: 'admin-shell' }, [
    sideEl,
    el('div', { class: 'admin-main' }, [
      el('div', { class: 'admin-topbar' }, [
        menuBtn,
        titleEl,
        el('div', { class: 'grow', style: 'flex:1' }),
        mdIconButton({ icon: 'sun', label: t('settings.darkMode'), onClick: () => { toggleTheme(); } }),
        el('div', { class: 'who', html: `${t('role.' + role)}: <b>${s.profile ? s.profile.ism : (s.email || '')}</b>` }),
      ]),
      contentEl,
    ]),
  ]);

  // requests badge yangilanishi uchun
  const unsub = adminStore.subscribe(() => buildNav());

  buildNav();
  renderSection();
  root.replaceChildren(shell);

  return { destroy: () => { unsub(); if (typeof cleanup === 'function') cleanup(); } };
}

export default createAdminShell;
