// ============================================================
//  farmer/shell.js — Farmer ilova qobig'i v2 (PERSISTENT LAYOUT)
//  Muammo: avval har tab render bo'lganda header+bottomNav qayta
//  qurilib "sakrardi". Endi: bitta barqaror qobiq, faqat kontent
//  (<main>) almashtiriladi — header va bottomNav UMUMAN o'zgarmaydi.
//
//  Tuzilish:
//    [md-app]
//      [topbar] — avatar | tab-sarlavha | qo'ng'iroq  (barqaror)
//      [main]   — FAQAT shu qism almashadi (scroll ham shu yerda)
//      [bottomnav] — 4 tab (barqaror)
//
//  Tab'lar `appBar()` chaqirmaydi — sarlavhani nav.setTitle() orqali
//  topbar'ga uzatadi. Eski appBar() chaqiruvlari ishlashda davom
//  etadi — ular DOM'ga qo'shilmaydi (render funksiyasida filtrlanadi).
// ============================================================

import { el, mount } from '../shared/dom.js';
import { t } from '../core/i18n/index.js';
import { slIcon, ICONS } from '../design-system/index.js';
import { createProfileDrawer } from './profileDrawer.js';
import { renderOnboarding } from './onboarding.js';
import { authStore } from '../features/auth/index.js';

import { renderHomeTab }            from '../features/telemetry/views/homeTab.js';
import { renderNotificationsTab }   from '../features/telemetry/views/notificationsTab.js';
import { renderLakesTab }           from '../features/lakes/views/lakesTab.js';
import { renderDevicesTab }         from '../features/devices/views/devicesTab.js';
import { renderProfileTab }         from '../features/auth/views/profileTab.js';
import { renderAiHomeTab }          from '../features/ai/views/aiHomeTab.js';
import { renderReportsTab }         from '../features/telemetry/views/reportsTab.js';
import { renderAnnouncementsTab }   from '../features/announcements/views/announcementsTab.js';

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
  { id: 'home',    icon: 'home',     labelKey: 'nav.home' },
  { id: 'lakes',   icon: 'droplet',  labelKey: 'nav.lakes' },
  { id: 'elonlar', icon: 'bell',     labelKey: 'nav.announcements' },
  { id: 'reports', icon: 'trendUp',  labelKey: 'nav.reports' },
];
const NAV_IDS = NAV.map((x) => x.id);

export function createShell(root, ctx = {}) {
  let activeTab  = 'home';
  let subPage    = null;
  let tabCleanup = null;
  let onboardingActive = false;

  const uid = authStore.getState().uid;
  try { onboardingActive = localStorage.getItem('sl_onboarded_' + uid) !== 'true'; } catch (_) {}

  /* ============================================================
     BARQAROR QOBIQ ELEMENTLARI (bir marta quriladi)
     ============================================================ */

  /* --- TopBar: avatar+ism | bell (barqaror, o'zgarmaydi) --- */
  const sUser = authStore.getState();
  const uName = sUser.profile
    ? (sUser.profile.ism + (sUser.profile.fam ? ' ' + sUser.profile.fam : ''))
    : (sUser.email || '');
  const uRole = t('role.' + (sUser.role || 'farmer'));

  const bellDotEl = el('span', { class: 'ni-dot',
    style: 'display:none;position:absolute;top:4px;right:4px;width:8px;height:8px' });
  const bellBtn   = el('button', { class: 'md-iconbtn', type: 'button',
    'aria-label': t('dash.alerts'), style: 'position:relative;flex:none' },
    [el('span', { html: slIcon(ICONS.alert.bell, 22) }), bellDotEl]);
  bellBtn.addEventListener('click', () => nav.switchTab('alerts'));

  // Foydalanuvchi info bloki (topbar o'rta qism)
  const userBlock = el('div', { class: 'grow', style: 'min-width:0' }, [
    el('div', { style: 'font-size:15px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap',
      text: uName }),
    el('div', { style: 'font-size:11px;opacity:.65;margin-top:1px', text: uRole }),
  ]);

  let avatarBtn = null;   // profileDrawer qaytaradi

  const topbar = el('div', { class: 'md-appbar', style: 'gap:var(--sl-sp-2)' }, [
    el('span', { id: 'shell-avatar-slot' }),
    userBlock,
    bellBtn,
  ]);

  /* --- BottomNav (bir marta quriladi, active sinf yangilanadi) --- */
  const navItems = NAV.map((n) => {
    const btn = el('button', { class: 'md-navitem', type: 'button',
      'aria-label': t(n.labelKey) }, [
      el('span', { class: 'ni-ic', html: slIcon(n.icon, 22) }),
      el('span', { class: 'ni-label', text: t(n.labelKey) }),
    ]);
    btn.addEventListener('click', () => nav.switchTab(n.id));
    return { id: n.id, btn };
  });
  const bottomnav = el('nav', { class: 'md-bottomnav', role: 'navigation' },
    navItems.map((x) => x.btn));

  /* --- Kontent zone (faqat shu almashadi) --- */
  const mainZone = el('div', { class: 'shell-main' });

  /* --- Yig'ish --- */
  const appEl = el('div', { class: 'md-app' }, [topbar, mainZone, bottomnav]);

  /* ============================================================
     NAV OB'EKTI
     ============================================================ */
  const nav = {
    switchTab(id) {
      if (id === activeTab && !subPage) return;
      activeTab = id; subPage = null;
      renderMain();
    },
    push(renderFn) { subPage = { render: renderFn }; renderMain(); },
    back()         { subPage = null; renderMain(); },
    reTab()        { renderMain(); },
    setTitle()     { /* topbar barqaror — sarlavha shart emas */ },
    setBell(on)    { bellDotEl.style.display = on ? '' : 'none'; },
    logout: ctx.onLogout,
  };

  /* ============================================================
     BOTTOMNAV ACTIVE BELGILASH
     ============================================================ */
  function updateNav() {
    const active = NAV_IDS.includes(activeTab) ? activeTab : NAV_IDS[0];
    navItems.forEach(({ id, btn }) => btn.classList.toggle('active', id === active));
  }

  /* ============================================================
     KONTENT RENDER (faqat mainZone ichini almashtiradi)
     ============================================================ */
  function renderMain() {
    /* cleanup */
    if (typeof tabCleanup === 'function') { try { tabCleanup(); } catch (_) {} }
    tabCleanup = null;
    window.scrollTo(0, 0);

    updateNav();

    if (subPage) {
      const node = subPage.render(nav);
      // Sub-sahifada bottomnav va topbar ko'rinmasin
      bottomnav.style.display = 'none';
      topbar.style.display = 'none';
      tabCleanup = () => { bottomnav.style.display = ''; topbar.style.display = ''; };
      mount(mainZone, node);
      if (node.__cleanup) {
        const prev = tabCleanup;
        tabCleanup = () => { prev(); node.__cleanup(); };
      }
      return;
    }

    bottomnav.style.display = '';
    topbar.style.display = '';

    const renderer = TABS[activeTab];
    if (!renderer) return;

    const raw = renderer(nav);
    tabCleanup = raw && raw.__cleanup ? raw.__cleanup : null;

    // Tablar ikkita tuzilishda kelishi mumkin:
    // 1) Yangi tablar: to'g'ridan-to'g'ri md-content qaytaradi
    // 2) Eski tablar: [md-appbar + md-content] tuzilishi
    // Ikkalasida ham md-appbar olib tashlanadi (topbar'da bor)
    if (raw && raw.querySelector) {
      const inlineBar = raw.querySelector(':scope > .md-appbar');
      if (inlineBar) inlineBar.remove();
    }

    mount(mainZone, raw);
  }

  /* ============================================================
     ONBOARDING
     ============================================================ */
  function renderOnboard() {
    topbar.style.display = 'none';
    bottomnav.style.display = 'none';
    const node = renderOnboarding(uid, () => {
      onboardingActive = false;
      topbar.style.display = '';
      bottomnav.style.display = '';
      renderMain();
    });
    mount(mainZone, node);
  }

  /* ============================================================
     ISHGA TUSHIRISH
     ============================================================ */
  root.replaceChildren(appEl);

  // Avatar tugmasini topbar'ga qo'shish
  avatarBtn = createProfileDrawer(nav);
  const slot = topbar.querySelector('#shell-avatar-slot');
  slot.replaceWith(avatarBtn);

  // Bosh sahifa sarlavhasi
  nav.setTitle(t('nav.home'));

  if (onboardingActive) renderOnboard();
  else renderMain();

  return { destroy: () => { if (typeof tabCleanup === 'function') tabCleanup(); } };
}

export default createShell;
