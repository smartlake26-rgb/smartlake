// ============================================================
//  features/ai/views/aiTab.js — AI TAVSIYA tabi (D-bosqich)
//  Provayder tanlovi (hozircha faqat lokal qoidalar faol, LLM'lar
//  "tez orada"), tavsiya kartalari (darajaga qarab rang), "Yangilash",
//  tahlil xulosasi (qancha ma'lumot o'qildi). Fermer ilovani ochib
//  tabga kirganda tavsiya avtomatik yangi generatsiya qilinadi.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { toast } from '../../../shared/toast.js';
import { mdCard, mdButton } from '../../../shared/ui/index.js';
import { PROVIDERS, getAdvice, getSelectedProviderId, setSelectedProviderId } from '../aiService.js';

const SEV_STYLE = {
  crit: { color: 'var(--md-critical)', bg: 'var(--md-critical-soft)' },
  warn: { color: 'var(--md-warning)', bg: 'var(--md-warning-soft)' },
  info: { color: 'var(--md-primary)', bg: 'color-mix(in srgb, var(--md-primary) 10%, transparent)' },
  ok: { color: 'var(--md-success)', bg: 'var(--md-success-soft)' },
};

export function buildAiTab({ isUz, getParams, onGoTab }) {
  const listBox = el('div', { class: 'stack-2' });
  const metaLine = el('div', { class: 't-caption', style: 'margin-top:8px' });
  let loading = false;

  // --- provayder tanlovi ---
  const provRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px' },
    PROVIDERS.map((p) => {
      const active = p.id === getSelectedProviderId();
      const avail = p.available();
      const b = el('button', {
        class: 'md-tab' + (active ? ' active' : ''),
        style: 'flex:none;padding:7px 12px;font-size:11.5px' + (avail ? '' : ';opacity:.5'),
        html: `<span>${p.name}${avail ? '' : (isUz ? ' · tez orada' : ' · скоро')}</span>`,
      });
      b.addEventListener('click', () => {
        if (!avail) { toast(isUz ? 'Bu provayder hali ulanmagan (arxitektura tayyor)' : 'Провайдер ещё не подключён', 'err'); return; }
        setSelectedProviderId(p.id);
        [...provRow.children].forEach((c) => c.classList.remove('active'));
        b.classList.add('active');
        load(true);
      });
      return b;
    }));

  async function load(force = false) {
    if (loading) return;
    loading = true;
    mount(listBox, el('div', { class: 'sk sk-card', style: 'height:90px' }), el('div', { class: 'sk sk-card', style: 'height:90px' }));
    try {
      const res = await getAdvice(getParams(), { force, isUz });
      const cards = res.advices.map((a, i) => {
        const st = SEV_STYLE[a.severity] || SEV_STYLE.info;
        const card = el('div', {
          class: 'md-card anim-up',
          style: `border-left:4px solid ${st.color};padding:14px`,
        }, [
          el('div', { style: 'display:flex;align-items:flex-start;gap:10px' }, [
            el('div', { style: `width:38px;height:38px;border-radius:var(--shape-md);flex:none;display:inline-flex;align-items:center;justify-content:center;background:${st.bg};color:${st.color}`, html: icon(a.icon, 19) }),
            el('div', { class: 'grow' }, [
              el('div', { style: `font-weight:800;font-size:14px;color:${st.color}`, text: a.title }),
              el('div', { class: 't-body-sm', style: 'margin-top:4px;line-height:1.5;color:var(--md-on-surface)', text: a.text }),
              a.action ? el('div', { style: 'margin-top:8px' }, [
                mdButton({ label: a.action.label, variant: 'tonal', onClick: () => onGoTab && onGoTab(a.action.tab || 'holat') }),
              ]) : null,
            ]),
          ]),
        ]);
        card.style.animationDelay = `${Math.min(i * 70, 280)}ms`;
        card.style.animationFillMode = 'both';
        return card;
      });
      mount(listBox, ...cards);
      const c = res.context;
      metaLine.textContent = (isUz
        ? `Tahlil: ${c.trend24h.points} nuqta (24 soat) · ${c.week.days} kun arxiv · ${c.devices.online}/${c.devices.total} qurilma onlayn · dvigatel: ${res.providerName} · ${new Date(res.at).toLocaleTimeString()}`
        : `Анализ: ${c.trend24h.points} точек (24ч) · ${c.week.days} дн архива · ${c.devices.online}/${c.devices.total} онлайн · движок: ${res.providerName}`);
    } catch (e) {
      mount(listBox, el('div', { class: 'md-banner warn', text: (e && e.message) || 'Xato' }));
    } finally { loading = false; }
  }

  const node = el('div', { class: 'stack' }, [
    mdCard([
      el('div', { class: 'row-between', style: 'margin-bottom:10px' }, [
        el('span', { class: 't-title-sm', style: 'display:flex;align-items:center;gap:6px' }, [
          el('span', { html: icon('sun', 17), style: 'color:var(--md-tertiary);display:inline-flex' }),
          el('span', { text: isUz ? 'AI tavsiyalar' : 'AI советы' }),
        ]),
        mdButton({ label: isUz ? 'Yangilash' : 'Обновить', variant: 'outlined', onClick: () => load(true) }),
      ]),
      provRow,
      el('div', { class: 't-caption', style: 'margin-bottom:10px', text: isUz
        ? "Tavsiyalar ko'lning joriy, 24 soatlik va 7 kunlik ma'lumotlari asosida ishlab chiqiladi."
        : 'Советы формируются по текущим, суточным и недельным данным озера.' }),
      listBox,
      metaLine,
    ]),
  ]);

  load(true);   // fermer tabga kirganda — yangi tavsiya
  return node;
}

export default buildAiTab;
