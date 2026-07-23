// ============================================================
//  features/announcements/views/announcementsTab.js — E'LONLAR tabi
//  (ANN-V1) SuperAdmin xabarlari fermerga: yangilik / video dars /
//  muhim ogohlantirish / texnik xizmat / tavsiya.
//  Sof prezentatsiya: announcementsService (o'qish-faqat) + DS.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { appBar } from '../../../shared/ui/index.js';
import {
  slIcon, slCard, slBadge, slButton, slEmptyState,
} from '../../../design-system/index.js';
import { fetchAnnouncements, ANN_STYLE } from '../announcementsService.js';

function fmtDate(ts, isUz) {
  if (!ts) return '';
  const d = new Date(ts); const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Bitta e'lon kartasi (reusable — dashboard preview ham ishlatadi). */
export function announcementCard(a, { compact = false, isUz = true } = {}) {
  const st = ANN_STYLE[a.type] || ANN_STYLE.news;
  return slCard([
    el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-3);align-items:flex-start' }, [
      el('div', {
        style: `width:40px;height:40px;border-radius:var(--sl-r-md);flex:none;display:flex;`
          + `align-items:center;justify-content:center;`
          + `background:color-mix(in srgb, var(${st.colorVar}) 12%, transparent);color:var(${st.colorVar})`,
        html: slIcon(st.icon, 20),
      }),
      el('div', { class: 'sl-grow' }, [
        el('div', { class: 'sl-row-between', style: 'gap:var(--sl-sp-2)' }, [
          el('div', { class: 'sl-subtitle', text: a.title }),
          slBadge({ type: a.type === 'warning' ? 'warning' : a.type === 'tip' ? 'ai' : 'info',
            label: t('ann.type_' + a.type), dot: false }),
        ]),
        a.body ? el('div', {
          class: 'sl-body-sm sl-text-secondary',
          style: `margin-top:4px${compact ? ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' : ''}`,
          text: a.body,
        }) : null,
        el('div', { class: 'sl-row-between', style: 'margin-top:var(--sl-sp-2)' }, [
          el('span', { class: 'sl-caption', text: fmtDate(a.createdAt, isUz) }),
          a.link && !compact ? slButton({ label: t('ann.open'), variant: 'text', size: 'sm',
            onClick: () => window.open(a.link, '_blank', 'noopener') }) : el('span'),
        ]),
      ].filter(Boolean)),
    ]),
  ]);
}

export function renderAnnouncementsTab() {
  const isUz = detectLocale() === 'uz';
  const content = el('div', { class: 'md-content' });
  const node = el('div', {}, [appBar({ title: t('ann.title'), subtitle: t('ann.subtitle') }), content]);

  async function load(force = false) {
    mount(content, el('div', { class: 'sl-stack' }, [
      el('div', { class: 'sl-skeleton card', style: 'height:110px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:110px' }),
    ]));
    const items = await fetchAnnouncements({ force });
    if (!items || !items.length) {
      mount(content, slEmptyState({
        icon: 'bell', title: t('ann.empty'), desc: t('ann.emptyDesc'),
        action: slButton({ label: t('lakespg.retry'), variant: 'text', onClick: () => load(true) }),
      }));
      return;
    }
    mount(content, el('div', { class: 'sl-stack' },
      items.map((a, i) => {
        const card = announcementCard(a, { isUz });
        card.classList.add('sl-anim-up');
        card.style.animationDelay = `${Math.min(i * 60, 240)}ms`;
        card.style.animationFillMode = 'both';
        return card;
      })));
  }

  load();
  return node;
}

export default renderAnnouncementsTab;
