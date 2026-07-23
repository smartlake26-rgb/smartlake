// farmer/shell.js — Oddiy va ishonchli shell
import { el, mount } from '../shared/dom.js';
import { t } from '../core/i18n/index.js';
import { slIcon, ICONS } from '../design-system/index.js';
import { createProfileDrawer } from './profileDrawer.js';
import { renderOnboarding } from './onboarding.js';
import { authStore } from '../features/auth/index.js';

import { renderHomeTab }          from '../features/telemetry/views/homeTab.js';
import { renderNotificationsTab } from '../features/telemetry/views/notificationsTab.js';
import { renderLakesTab }         from '../features/lakes/views/lakesTab.js';
import { renderDevicesTab }       from '../features/devices/views/devicesTab.js';
import { renderProfileTab }       from '../features/auth/views/profileTab.js';
import { renderAiHomeTab }        from '../features/ai/views/aiHomeTab.js';
import { renderReportsTab }       from '../features/telemetry/views/reportsTab.js';
import { renderAnnouncementsTab } from '../features/announcements/views/announcementsTab.js';

const TABS = {
  home:    renderHomeTab,
  lakes:   renderLakesTab,
  elonlar: renderAnnouncementsTab,
  reports: renderReportsTab,
  devices: renderDevicesTab,
  alerts:  renderNotificationsTab,
  profile: renderProfileTab,
  ai:      renderAiHomeTab,
};

const NAV_ITEMS = [
  { id: 'home',    icon: 'home',    labelKey: 'nav.home' },
  { id: 'lakes',   icon: 'droplet', labelKey: 'nav.lakes' },
  { id: 'elonlar', icon: 'bell',    labelKey: 'nav.announcements' },
  { id: 'reports', icon: 'trendUp', labelKey: 'nav.reports' },
];
const NAV_IDS = NAV_ITEMS.map((x) => x.id);

export function createShell(root, ctx = {}) {
  let activeTab = 'home';
  let subPage   = null;
  let cleanup   = null;
  let onboardingActive = false;

  const uid = authStore.getState().uid;
  try { onboardingActive = localStorage.getItem('sl_onboarded_' + uid) !== 'true'; } catch (_) {}

  const sUser = authStore.getState();
  const uName = sUser.profile
    ? (sUser.profile.ism + (sUser.profile.fam ? ' ' + sUser.profile.fam : '')).trim()
    : (sUser.email || '');

  // Bell dot — topbar'da bir marta
  const bellDotEl = el('span', {
    style: 'display:none;position:absolute;top:4px;right:4px;width:8px;height:8px;'
         + 'border-radius:50%;background:var(--md-critical)',
  });
  const bellBtn = el('button', {
    class: 'md-iconbtn', type: 'button', 'aria-label': t('dash.alerts'),
    style: 'position:relative;flex:none',
  });
  bellBtn.innerHTML = slIcon(ICONS.alert.bell, 22);
  bellBtn.appendChild(bellDotEl);

  // Topbar — bir marta quriladi
  const topbar = el('div', { class: 'md-appbar', style: 'gap:8px' }, [
    el('span', { id: 'tb-avatar' }),
    el('div', { class: 'grow', style: 'min-width:0;overflow:hidden' }, [
      el('div', {
        style: 'font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        text: uName,
      }),
    ]),
    bellBtn,
  ]);

  const nav = {
    switchTab(id) { activeTab = id; subPage = null; render(); },
    push(fn)      { subPage = { render: fn }; render(); },
    back()        { subPage = null; render(); },
    reTab()       { render(); },
    setBell(on)   { bellDotEl.style.display = on ? '' : 'none'; },
    setTitle()    {},
    logout: ctx.onLogout,
  };

  function doCleanup() {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (_) {} }
    cleanup = null;
  }

  // BottomNav — har render yangilanadi (active sinfi)
  function buildBottomNav() {
    const active = NAV_IDS.includes(activeTab) ? activeTab : NAV_IDS[0];
    return el('nav', { class: 'md-bottomnav' }, NAV_ITEMS.map((n) => {
      const btn = el('button', {
        class: 'md-navitem' + (n.id === active ? ' active' : ''),
        type: 'button',
      }, [
        el('span', { class: 'ni-ic', html: slIcon(n.icon, 22) }),
        el('span', { class: 'ni-label', text: t(n.labelKey) }),
      ]);
      btn.addEventListener('click', () => nav.switchTab(n.id));
      return btn;
    }));
  }

  function render() {
    doCleanup();
    window.scrollTo(0, 0);

    if (onboardingActive) {
      const node = renderOnboarding(uid, () => {
        onboardingActive = false;
        render();
      });
      root.replaceChildren(node);
      return;
    }

    if (subPage) {
      const node = subPage.render(nav);
      cleanup = node.__cleanup || null;
      root.replaceChildren(node);
      return;
    }

    // Asosiy tab: topbar + kontent + bottomnav
    const renderer = TABS[activeTab];
    const tabNode  = renderer ? renderer(nav) : el('div');

    // Eski tab'lar [md-appbar + md-content] qaytaradi — appbar olib tashlanadi
    if (tabNode.querySelector) {
      const bar = tabNode.querySelector(':scope > .md-appbar');
      if (bar) bar.remove();
    }

    cleanup = tabNode.__cleanup || null;

    const shell = el('div', { class: 'md-app' }, [topbar, tabNode, buildBottomNav()]);
    root.replaceChildren(shell);

    // Bell event (bellBtn topbar'da, lekin har render keyin eski listener yo'qoladi)
    bellBtn.onclick = () => nav.switchTab('alerts');
  }

  // Avatar bir marta qo'shiladi
  const avatarBtn = createProfileDrawer(nav);
  topbar.querySelector('#tb-avatar').replaceWith(avatarBtn);

  render();

  return { destroy: doCleanup };
}

export default createShell;
