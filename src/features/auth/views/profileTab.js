// ============================================================
//  features/auth/views/profileTab.js — Profil + Sozlamalar
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, getLocale, setLocale as setI18nLocale } from '../../../core/i18n/index.js';
import { icon } from '../../../shared/icons.js';
import { appBar, mdCard, listItem, mdButton, select, openDialog } from '../../../shared/ui/index.js';
import { toggleTheme, getTheme } from '../../../shared/ui/theme.js';
import { LOCALES } from '../../../core/config.js';
import { authService, authStore } from '../index.js';
import { userService } from '../../users/index.js';
import { renderProfileEditPage } from './profileEditPage.js';

const APP_VERSION = '2.0';

function switchRow(labelText, icName, on, onToggle) {
  const knob = el('span', { style: `position:absolute;top:2px;left:${on ? '22px' : '2px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left var(--motion) var(--ease)` });
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

export function renderProfileTab(nav) {
  const s = authStore.getState();
  const p = s.profile || {};
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('nav.profile') }), content]);

  function render() {
    const st = authStore.getState();
    const pr = st.profile || {};
    // Profil karta
    const profileCard = mdCard([
      el('div', { class: 'row', style: 'gap:14px' }, [
        el('div', { class: 'md-avatar', style: 'width:56px;height:56px;font-size:20px', text: `${(pr.ism || '?')[0] || ''}${(pr.fam || '')[0] || ''}`.toUpperCase() }),
        el('div', { class: 'grow' }, [
          el('div', { class: 't-title', text: `${pr.ism || ''} ${pr.fam || ''}` }),
          el('div', { class: 't-body-sm muted', text: st.email || '' }),
        ]),
        mdButton({ label: t('common.edit'), variant: 'tonal', onClick: () => nav.push(renderProfileEditPage) }),
      ]),
      el('div', { class: 'md-list', style: 'margin-top:12px' }, [
        listItem({ leading: 'phone', title: pr.phone || '—', subtitle: t('profile.phone') }),
        listItem({ leading: 'location', title: `${pr.vil || '—'}${pr.tum ? ', ' + pr.tum : ''}`, subtitle: t('profile.region') }),
      ]),
    ], { elevated: true });

    // Sozlamalar
    const darkOn = getTheme() === 'dark';
    const localeSel = select(LOCALES.map((l) => ({ value: l, label: l.toUpperCase() })), getLocale());
    localeSel.addEventListener('change', async () => {
      setI18nLocale(localeSel.value);
      try { if (st.uid) await userService.setLocale(st.uid, localeSel.value); } catch (_) { /* ignore */ }
      nav.reTab();
    });

    const settingsCard = mdCard([
      el('div', { class: 't-label muted', style: 'margin-bottom:6px', text: t('settings.title') }),
      switchRow(t('settings.darkMode'), darkOn ? 'moon' : 'sun', darkOn, () => { toggleTheme(); nav.reTab(); }),
      el('div', { class: 'md-listitem' }, [
        el('div', { class: 'li-lead', html: icon('globe', 20) }),
        el('div', { class: 'grow t-title-sm', text: t('settings.language') }),
        localeSel,
      ]),
      listItem({ leading: 'mail', title: t('settings.changePassword'), onClick: async () => {
        try { await authService.resetPassword(st.email); toast(t('auth.resetSent'), 'ok'); } catch (_) { toast(t('error.generic'), 'err'); }
      } }),
      listItem({ leading: 'info', title: t('settings.about'), subtitle: `SmartLake v${APP_VERSION}` }),
    ]);

    const logoutBtn = el('div', { style: 'margin-top:16px' }, [
      mdButton({ label: t('common.logout'), variant: 'danger', icon: 'logout', full: true, onClick: () => {
        openDialog({
          title: t('common.logout') + '?', body: t('settings.logoutConfirm'),
          actions: [
            { label: t('common.cancel'), variant: 'text' },
            { label: t('common.logout'), variant: 'text', onClick: () => authService.signOut() },
          ],
        });
      } }),
    ]);

    mount(content, el('div', { class: 'stack' }, [profileCard, settingsCard, logoutBtn]));
  }

  render();
  return node;
}

export default renderProfileTab;
