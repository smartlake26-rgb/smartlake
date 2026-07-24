// ============================================================
//  features/settings/views/settingsTab.js — SOZLAMALAR
//  Profil'dan ko'chirilgan: Tungi rejim, Til, Admin panel,
//  Parol o'zgartirish, Onboarding, Chiqish
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, getLocale, setLocale as setI18nLocale } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { appBar, mdCard, listItem, mdButton, select, openDialog } from '../../../shared/ui/index.js';
import { toggleTheme, getTheme } from '../../../shared/ui/theme.js';
import { LOCALES } from '../../../core/config.js';
import { authService, authStore, access } from '../../auth/index.js';
import { userService } from '../../users/index.js';

const APP_VERSION = '2.0';

function switchRow(labelText, icName, on, onToggle) {
  const knob = el('span', {
    style: `position:absolute;top:2px;left:${on ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left var(--motion) var(--ease)`,
  });
  const track = el('button', {
    style: `position:relative;width:46px;height:24px;border-radius:999px;border:none;cursor:pointer;background:${on ? 'var(--md-primary)' : 'var(--md-outline)'}`,
  }, [knob]);
  track.addEventListener('click', () => onToggle(track, knob));
  return el('div', { class: 'md-listitem' }, [
    el('div', { class: 'li-lead', html: icon(icName, 20) }),
    el('div', { class: 'grow t-title-sm', text: labelText }),
    track,
  ]);
}

export function renderSettingsTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('menu.settings') }), content]);

  function render() {
    const st = authStore.getState();

    // Tungi rejim
    const darkOn = getTheme() === 'dark';

    // Til
    const localeSel = select(LOCALES.map((l) => ({ value: l, label: l.toUpperCase() })), getLocale());
    localeSel.addEventListener('change', async () => {
      setI18nLocale(localeSel.value);
      try { if (st.uid) await userService.setLocale(st.uid, localeSel.value); } catch (_) {}
      nav.reTab();
    });

    const settingsCard = mdCard([
      // Push bildirishnomalar
      (() => {
        const pushStatus = ('Notification' in window) ? Notification.permission : 'unsupported';
        const pushOn = pushStatus === 'granted';
        const pushRow = switchRow(
          pushOn ? t('settings.pushOn') : t('settings.pushOff'),
          'bell', pushOn, async (track, knob) => {
            const { pushService } = await import('../../../core/pushService.js');
            if (pushService.isEnabled()) {
              await pushService.disable(st.uid);
            } else {
              await pushService.requestPermission(st.uid);
            }
            render();  // holat yangilanadi
          }
        );
        if (pushStatus === 'unsupported') {
          pushRow.style.opacity = '0.5';
          pushRow.title = "Bu qurilma push bildirishnomalarni qo'llab-quvvatlamaydi";
        }
        return pushRow;
      })(),

      // Admin panel (faqat admin uchun)
      ...(access.isAdmin(st.role) ? [
        listItem({
          leading: 'shield',
          title: "Admin Panelga o'tish",
          subtitle: "Tizimni to'liq boshqarish va monitoring qilish",
          onClick: () => { window.location.href = '/admin.html'; },
        }),
      ] : []),

      // Tungi rejim
      switchRow(t('settings.darkMode'), darkOn ? 'moon' : 'sun', darkOn, () => {
        toggleTheme();
        render();  // qayta chizish (icon yangilanadi)
      }),

      // Til
      el('div', { class: 'md-listitem' }, [
        el('div', { class: 'li-lead', html: icon('globe', 20) }),
        el('div', { class: 'grow t-title-sm', text: t('settings.language') }),
        localeSel,
      ]),

      // Parol o'zgartirish
      listItem({
        leading: 'mail',
        title: t('settings.changePassword'),
        onClick: async () => {
          try {
            await authService.resetPassword(st.email);
            toast(t('auth.resetSent'), 'ok');
          } catch (_) { toast(t('error.generic'), 'err'); }
        },
      }),

      // Onboarding
      listItem({
        leading: 'help',
        title: "Ilova yo'riqnomasi (Onboarding)",
        subtitle: "Tizim imkoniyatlarini qaytadan ko'rish",
        onClick: () => {
          try { localStorage.removeItem('sl_onboarded_' + st.uid); } catch (_) {}
          window.location.reload();
        },
      }),

      // Ilova haqida
      listItem({ leading: 'info', title: t('settings.about'), subtitle: `SmartLake v${APP_VERSION}` }),
    ]);

    // Chiqish
    const logoutBtn = el('div', { style: 'margin-top:16px' }, [
      mdButton({
        label: t('common.logout'), variant: 'danger', icon: 'logout', full: true,
        onClick: () => {
          openDialog({
            title: t('common.logout') + '?',
            body: t('settings.logoutConfirm'),
            actions: [
              { label: t('common.cancel'), variant: 'text' },
              { label: t('common.logout'), variant: 'text', onClick: () => authService.signOut() },
            ],
          });
        },
      }),
    ]);

    mount(content, el('div', { class: 'stack' }, [settingsCard, logoutBtn]));
  }

  render();
  return node;
}

export default renderSettingsTab;
