// ============================================================
//  farmer/shell.js — Farmer ilova qobig'i (oddiy, ishonchli)
//  Har tab o'z to'liq sahifasini qaytaradi.
//  Topbar: shell tomonidan bir marta quriladi, tab'lar content'ini
//  mainZone'ga qo'yadi. bottomNav barqaror qoladi.
// ============================================================

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

const NAV = [
  { id: 'home',    icon: 'home',    labelKey: 'nav.home' },
  { id: 'lakes',   icon: 'droplet', labelKey: 'nav.lakes' },
  { id: 'elonlar', icon: 'bell',    labelKey: 'nav.announcements' },
  { id: 'reports', icon: 'trendUp', labelKey: 'nav.reports' },
];
const NAV_IDS = NAV.map((x) => x.id);

export function createShell(root, ctx = {}) {
  let activeTab = 'home';
  let subPage   = null;
  let cleanup   = null;
  let onboardingActive = false;

  const uid = authStore.getState().uid;
  try { onboardingActive = localStorage.getItem('sl_onboarded_' + uid) !== 'true'; } catch (_) {}

  /* ----------------------------------------------------------
     TOPBAR — bir marta quriladi, o'zgarmaydi
     ---------------------------------------------------------- */
  const sUser    = authStore.getState();
  const uName    = sUser.profile
    ? (sUser.profile.ism + (sUser.profile.fam ? ' ' + sUser.profile.fam : '')).trim()
    : (sUser.email || '');

  const bellDotEl = el('span', { class: 'ni-dot',
    style: 'display:none;position:absolute;top:4px;right:4px;width:8px;height:8px;border-radius:50%;background:var(--md-critical)' });
  const bellBtn = el('button', { class: 'md-iconbtn', type: 'button',
    'aria-label': t('dash.alerts'), style: 'position:relative;flex:none' });
  bellBtn.innerHTML = slIcon(ICONS.alert.bell, 22);
  bellBtn.appendChild(bellDotEl);
  bellBtn.addEventListener('click', () => nav.switchTab('alerts'));

  const topbar = el('div', { class: 'md-appbar', style: 'gap:8px' }, [
    el('span', { id: 'tb-avatar' }),   // avatar shu yerga
    el('div', { class: 'grow', style: 'min-width:0;overflow:hidden' }, [
      el('div', {
        style: 'font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis',
        text: uName,
      }),
    ]),
    bellBtn,
  ]);

  /* ----------------------------------------------------------
     BOTTOMNAV — bir marta quriladi, active sinf yangilanadi
     ---------------------------------------------------------- */
  const navBtns = NAV.map((n) => {
    const btn = el('button', { class: 'md-navitem', type: 'button' }, [
      el('span', { class: 'ni-ic', html: slIcon(n.icon, 22) }),
      el('span', { class: 'ni-label', text: t(n.labelKey) }),
    ]);
    btn.addEventListener('click', () => nav.switchTab(n.id));
    return { id: n.id, btn };
  });
  const bottomnav = el('nav', { class: 'md-bottomnav' }, navBtns.map((x) => x.btn));

  /* ----------------------------------------------------------
     KONTENT ZONE — faqat shu almashinadi
     ---------------------------------------------------------- */
  const mainZone = el('div', { style: 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;min-height:0' });

  const appEl = el('div', { class: 'md-app', style: 'display:flex;flex-direction:column' },
    [topbar, mainZone, bottomnav]);

  /* ----------------------------------------------------------
     NAV
     ---------------------------------------------------------- */
  const nav = {
    switchTab(id) {
      if (id === activeTab && !subPage) return;
      activeTab = id; subPage = null;
      render();
    },
    push(renderFn)  { subPage = { render: renderFn }; render(); },
    back()          { subPage = null; render(); },
    reTab()         { render(); },
    setBell(on)     { bellDotEl.style.display = on ? '' : 'none'; },
    setTitle()      { /* topbar barqaror */ },
    logout: ctx.onLogout,
  };

  function updateNav() {
    const active = NAV_IDS.includes(activeTab) ? activeTab : NAV_IDS[0];
    navBtns.forEach(({ id, btn }) => btn.classList.toggle('active', id === active));
  }

  function doCleanup() {
    if (typeof cleanup === 'function') { try { cleanup(); } catch (_) {} }
    cleanup = null;
  }

  /* ----------------------------------------------------------
     RENDER — topbar va bottomnav UMUMAN O'ZGARMAYDI
     ---------------------------------------------------------- */
  function render() {
    doCleanup();
    window.scrollTo(0, 0);

    if (subPage) {
      /* Sub-sahifa: topbar/bottomnav yashiriladi */
      topbar.style.display    = 'none';
      bottomnav.style.display = 'none';
      mainZone.style.overflow = 'visible';
      const node = subPage.render(nav);
      cleanup = () => {
        topbar.style.display    = '';
        bottomnav.style.display = '';
        mainZone.style.overflow = '';
        if (node.__cleanup) node.__cleanup();
      };
      mount(mainZone, node);
      return;
    }

    /* Asosiy tab */
    topbar.style.display    = '';
    bottomnav.style.display = '';
    mainZone.style.overflow = '';
    updateNav();

    const renderer = TABS[activeTab];
    if (!renderer) return;

    const node = renderer(nav);

    /* Eski tablar [md-appbar + md-content] qaytaradi —
       md-appbar olib tashlanadi (topbar'da bor) */
    if (node && node.querySelector) {
      const bar = node.querySelector(':scope > .md-appbar');
      if (bar) bar.remove();
    }

    cleanup = node && node.__cleanup ? node.__cleanup : null;
    mount(mainZone, node);
  }

  /* ----------------------------------------------------------
     ONBOARDING
     ---------------------------------------------------------- */
  function renderOnboard() {
    topbar.style.display    = 'none';
    bottomnav.style.display = 'none';
    const node = renderOnboarding(uid, () => {
      onboardingActive = false;
      topbar.style.display    = '';
      bottomnav.style.display = '';
      render();
    });
    mount(mainZone, node);
  }

  /* ----------------------------------------------------------
     START
     ---------------------------------------------------------- */
  root.replaceChildren(appEl);

  // Avatar tugmasi
  const avatarBtn = createProfileDrawer(nav);
  topbar.querySelector('#tb-avatar').replaceWith(avatarBtn);

  if (onboardingActive) renderOnboard();
  else render();

  return { destroy: doCleanup };
}

export default createShell;
