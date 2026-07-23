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
import { slIcon, slIconButton, ICONS } from '../design-system/index.js';
import { createProfileDrawer } from './profileDrawer.js';
import { renderOnboarding } from './onboarding.js';
import { authStore } from '../features/auth/index.js';
import { getTheme, toggleTheme } from '../shared/ui/theme.js';

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

  /* --- TopBar: avatar | sarlavha | qo'ng'iroq --- */
  const titleEl    = el('div', { class: 'ab-title' });
  const bellDotEl  = el('span', { class: 'ni-dot', style: 'display:none;position:absolute;top:6px;right:8px' });
  const bellBtn    = el('button', { class: 'md-iconbtn', type: 'button',
    'aria-label': t('dash.alerts'), style: 'position:relative' },
    [el('span', { html: slIcon(ICONS.alert.bell, 22) }), bellDotEl]);
  bellBtn.addEventListener('click', () => nav.switchTab('alerts'));

  // Avatar (birinchi qurilganda, keyin o'zgarmaydi)
  let avatarBtn = null;   // profileDrawer qaytaradi, topbar tayyor bo'lgandan keyin qo'shiladi

  const topbar = el('div', { class: 'md-appbar', style: 'gap:var(--sl-sp-2)' }, [
    el('span', { id: 'shell-avatar-slot' }),   // avatar shu yerga qo'yiladi
    el('div', { class: 'grow' }, [titleEl]),
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
    setTitle(txt)  { titleEl.textContent = txt || ''; },
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

    /* Tab renderini chaqiramiz. Tab o'z ichida nav.setTitle() chaqiradi.
       Eski appBar() qaytaruvchi tablar ichida birinchi .md-appbar'ni
       topbar'ga olib tashlaymiz (ikki marta chiqmasligi uchun). */
    const raw = renderer(nav);
    tabCleanup = raw && raw.__cleanup ? raw.__cleanup : null;

    // Eski tablar: <div> [md-appbar, md-content] tuzilishi
    // md-appbar'dan sarlavha olinadi, kontent qismi mainZone'ga qo'yiladi
    if (raw && raw.querySelector) {
      const inlineBar = raw.querySelector('.md-appbar');
      if (inlineBar) {
        // Sarlavha matnini olish
        const titleNode = inlineBar.querySelector('.ab-title');
        if (titleNode) nav.setTitle(titleNode.textContent);
        inlineBar.remove();   // inline appbar'ni olib tashlaymiz
      } else {
        // homeTab: o'z headerini quradi — u allaqachon nav.setTitle ishlatmaydi
        // sarlavha bo'sh qoladi (homeTab avatarni o'zi header'ga qo'shgan edi — bu endi topbar vazifasi)
      }
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
