// ============================================================
//  farmer/shell.js — Farmer ilova qobig'i (MD3)
//  Bottom Navigation (5 tab) + to'liq ekranli sub-sahifalar (stack).
//  Har tab o'z listeneri/cleanup'iga ega; navigatsiyada tozalanadi.
// ============================================================

import { el } from '../shared/dom.js';
import { bottomNav } from '../shared/ui/index.js';
import { t } from '../core/i18n/index.js';

import { renderHomeTab } from '../features/telemetry/views/homeTab.js';
import { renderNotificationsTab } from '../features/telemetry/views/notificationsTab.js';
import { renderLakesTab } from '../features/lakes/views/lakesTab.js';
import { renderDevicesTab } from '../features/devices/views/devicesTab.js';
import { renderProfileTab } from '../features/auth/views/profileTab.js';
import { renderOnboarding } from './onboarding.js';
import { authStore } from '../features/auth/index.js';

const TABS = {
  home: renderHomeTab,
  lakes: renderLakesTab,
  devices: renderDevicesTab,
  alerts: renderNotificationsTab,
  profile: renderProfileTab,
};

export function createShell(root, ctx = {}) {
  let activeTab = 'home';
  let subPage = null;                 // { render(nav): Node } | null
  let cleanup = null;
  let onboardingActive = false;

  // Check onboarding status
  const uid = authStore.getState().uid;
  let onboarded = false;
  try {
    onboarded = localStorage.getItem('sl_onboarded_' + uid) === 'true';
  } catch (_) {}

  if (!onboarded) {
    onboardingActive = true;
  }

  const navItems = () => [
    { id: 'home', icon: 'home', label: t('nav.home') },
    { id: 'lakes', icon: 'droplet', label: t('nav.lakes') },
    { id: 'devices', icon: 'chip', label: t('nav.devices') },
    { id: 'alerts', icon: 'bell', label: t('nav.alerts'), dot: ctx.alerts && ctx.alerts() > 0 },
    { id: 'profile', icon: 'user', label: t('nav.profile') },
  ];

  const nav = {
    switchTab(id) { if (id === activeTab && !subPage) return; activeTab = id; subPage = null; render(); },
    push(renderFn) { subPage = { render: renderFn }; render(); },
    back() { subPage = null; render(); },
    reTab() { render(); },              // joriy tab'ni qayta chizish
    logout: ctx.onLogout,
  };

  function mountNode(node) {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (_) { /* ignore */ } }
    cleanup = (node && typeof node.__cleanup === 'function') ? node.__cleanup : null;
    root.replaceChildren(node);
    window.scrollTo(0, 0);
  }

  function render() {
    if (onboardingActive) {
      const onboardNode = renderOnboarding(uid, () => {
        onboardingActive = false;
        render();
      });
      mountNode(onboardNode);
      return;
    }
    if (subPage) { mountNode(subPage.render(nav)); return; }
    const tabNode = TABS[activeTab](nav);
    tabNode.classList.add('anim-up');   // DS-F: sahifa o'tish animatsiyasi
    const shell = el('div', { class: 'md-app' }, [tabNode, bottomNav({ items: navItems(), active: activeTab, onSelect: nav.switchTab })]);
    shell.__cleanup = tabNode.__cleanup;
    mountNode(shell);
  }

  render();
  return { destroy: () => { if (typeof cleanup === 'function') cleanup(); } };
}

export default createShell;
