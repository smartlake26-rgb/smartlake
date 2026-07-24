// ============================================================
//  features/auth/views/profileTab.js — Profil (faqat shaxsiy ma'lumotlar)
//  Sozlamalar alohida settingsTab.js da
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t } from '../../../core/i18n/index.js';
import { appBar, mdCard, listItem, mdButton } from '../../../shared/ui/index.js';
import { authStore } from '../index.js';
import { renderProfileEditPage } from './profileEditPage.js';

export function renderProfileTab(nav) {
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('nav.profile') }), content]);

  function render() {
    const st = authStore.getState();
    const pr = st.profile || {};

    const profileCard = mdCard([
      el('div', { class: 'row', style: 'gap:14px' }, [
        pr.photoUrl
          ? el('img', { src: pr.photoUrl, class: 'md-avatar', style: 'width:56px;height:56px;object-fit:cover;border:1px solid rgba(0,112,144,0.2)' })
          : el('div', { class: 'md-avatar', style: 'width:56px;height:56px;font-size:20px', text: `${(pr.ism || '?')[0] || ''}${(pr.fam || '')[0] || ''}`.toUpperCase() }),
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

    mount(content, el('div', { class: 'stack' }, [profileCard]));
  }

  render();
  return node;
}

export default renderProfileTab;
