// ============================================================
//  features/ai/views/aiTab.js — AI TAVSIYA tabi v2
//  (AI-V2, Design System 3.0 + sensorState integratsiyasi)
//
//  YANGI:
//  - Sensor holatlari (present/absent/disconnected/disabled/
//    faulty/calibration) har karta old-qismida ko'rsatiladi.
//  - DO/Harorat/pH mavjudligi header'da "data badge" bilan.
//  - UI'da son o'rniga status badge (sensor holati bilan).
//  - AI faqat ko'l ichida ishlaydi (Dashboarddan olib tashlangan).
//
//  SAQLANGAN: provayder tanlovi, getAdvice/buildContext,
//  force-yangilash, tahlil meta-qatori, buildAiTab imzosi.
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import {
  slIcon, slCard, slButton, slBadge,
} from '../../../design-system/index.js';
import {
  PROVIDERS, getAdvice, getSelectedProviderId, setSelectedProviderId,
} from '../aiService.js';
import { SENSOR_STATE, sensorStateI18nKey } from '../../telemetry/domain/sensorState.js';

/* Sensor holat badge'i — qiymat o'rniga ko'rsatiladi */
function sensorStateBadge(state) {
  if (state === SENSOR_STATE.PRESENT) return null;   // qiymat ko'rsatiladi, badge kerak emas
  const key = sensorStateI18nKey(state);
  if (!key) return null;
  const label = t(key);
  const type = state === SENSOR_STATE.FAULTY ? 'critical'
    : state === SENSOR_STATE.CALIBRATION ? 'warning'
    : state === SENSOR_STATE.DISCONNECTED ? 'warning'
    : 'offline';   // absent/disabled
  return slBadge({ type, label, dot: false });
}

/* Sensor mavjudligi belgisi sarlavhada */
function sensorAvailBadge(states, keys, isUz) {
  const labels = {
    do:  isUz ? 'DO' : 'DO',
    t:   isUz ? 'Harorat' : 'Темп.',
    ph:  'pH',
    tds: 'TDS',
  };
  const present = keys.filter((k) => states[k] === SENSOR_STATE.PRESENT);
  const missing = keys.filter((k) => states[k] !== SENSOR_STATE.PRESENT);
  if (!missing.length) return null;   // hammasi present
  return el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-1);display:flex;gap:5px;flex-wrap:wrap' }, [
    ...present.map((k) => slBadge({ type: 'healthy', label: labels[k], dot: false })),
    ...missing.map((k) => slBadge({ type: 'offline', label: `${labels[k]}: ${t(sensorStateI18nKey(states[k]) || 'sensor.absent')}`, dot: false })),
  ]);
}

const SEV_STYLE = {
  crit: { colorVar: '--sl-critical', bg: '--sl-critical-soft', icon: null },
  warn: { colorVar: '--sl-warning', bg: '--sl-warning-soft', icon: null },
  info: { colorVar: '--sl-primary', bg: null, icon: null },
  ok:   { colorVar: '--sl-success', bg: '--sl-success-soft', icon: null },
};

export function buildAiTab({ isUz, getParams, onGoTab }) {
  const listBox = el('div', { class: 'sl-stack' });
  const metaLine = el('div', { class: 'sl-caption', style: 'margin-top:var(--sl-sp-2)' });
  let loading = false;

  // --- provayder tanlovi (SAQLANGAN) ---
  const provRow = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:var(--sl-sp-2)' },
    PROVIDERS.map((p) => {
      const active = p.id === getSelectedProviderId();
      const avail = p.available();
      const b = el('button', {
        class: 'sl-tab' + (active ? ' active' : ''),
        style: avail ? '' : 'opacity:.5',
        text: p.name + (avail ? '' : (isUz ? ' · tez orada' : ' · скоро')),
      });
      b.addEventListener('click', () => {
        if (!avail) {
          toast(isUz ? 'Bu provayder hali ulanmagan (arxitektura tayyor)' : 'Провайдер ещё не подключён', 'err');
          return;
        }
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
    mount(listBox,
      el('div', { class: 'sl-skeleton card', style: 'height:96px' }),
      el('div', { class: 'sl-skeleton card', style: 'height:96px' }));
    try {
      const params = getParams();
      const res = await getAdvice(params, { force, isUz });
      const ctx = res.context;
      const ss = ctx.sensorStates || {};   // sensor holatlari

      // Sensor mavjudligi bloki (sarlavhada, tavsiyalar ustida)
      const availBlock = sensorAvailBadge(ss, ['do', 't', 'ph', 'tds'], isUz);

      const cards = res.advices.map((a, i) => {
        const st = SEV_STYLE[a.severity] || SEV_STYLE.info;
        const cardEl = slCard([
          el('div', { class: 'sl-row', style: 'gap:var(--sl-sp-3);align-items:flex-start' }, [
            el('div', { style: `width:40px;height:40px;border-radius:var(--sl-r-md);flex:none;`
              + `display:flex;align-items:center;justify-content:center;`
              + `background:color-mix(in srgb, var(${st.colorVar}) 13%, transparent);`
              + `color:var(${st.colorVar})`, html: slIcon(a.icon || 'info', 20) }),
            el('div', { class: 'sl-grow' }, [
              el('div', { style: `font-weight:800;font-size:14px;color:var(${st.colorVar})`, text: a.title }),
              el('div', { class: 'sl-body-sm', style: 'margin-top:5px;line-height:1.55;white-space:pre-line',
                text: a.text }),
              a.action ? el('div', { style: 'margin-top:var(--sl-sp-2)' }, [
                slButton({ label: a.action.label, variant: 'secondary', size: 'sm',
                  onClick: () => onGoTab && onGoTab(a.action.tab || 'holat') }),
              ]) : null,
            ].filter(Boolean)),
          ]),
        ], { cls: `border-l-${a.severity}` });
        // Sensor holati uchun renkli chiziq
        cardEl.style.borderLeft = `4px solid var(${st.colorVar})`;
        cardEl.classList.add('sl-anim-up');
        cardEl.style.animationDelay = `${Math.min(i * 70, 280)}ms`;
        cardEl.style.animationFillMode = 'both';
        return cardEl;
      });

      mount(listBox, ...[availBlock, ...cards].filter(Boolean));
      metaLine.textContent = (isUz
        ? `Tahlil: ${ctx.trend24h.points} nuqta (24 soat) · ${ctx.week.days} kun arxiv · ${ctx.devices.online}/${ctx.devices.total} qurilma onlayn · dvigatel: ${res.providerName}`
        : `Анализ: ${ctx.trend24h.points} точек (24ч) · ${ctx.week.days} дн архива · ${ctx.devices.online}/${ctx.devices.total} онлайн · движок: ${res.providerName}`);
    } catch (e) {
      mount(listBox, el('div', { class: 'sl-banner warn', text: (e && e.message) || 'Xato' }));
    } finally { loading = false; }
  }

  const node = el('div', {}, [slCard([
    el('div', { class: 'sl-row-between', style: 'margin-bottom:var(--sl-sp-2)' }, [
      el('span', { class: 'sl-card-title', style: 'display:flex;align-items:center;gap:6px' }, [
        el('span', { html: slIcon('sparkles', 17), style: 'color:var(--sl-ai);display:inline-flex' }),
        el('span', { text: isUz ? 'AI tavsiyalar' : 'AI советы' }),
      ]),
      slButton({ label: isUz ? 'Yangilash' : 'Обновить', variant: 'outlined', size: 'sm',
        onClick: () => load(true) }),
    ]),
    provRow,
    el('div', { class: 'sl-caption', style: 'margin-bottom:var(--sl-sp-2)', text: isUz
      ? "Tavsiyalar ko'lning joriy, 24 soatlik va 7 kunlik ma'lumotlari asosida ishlab chiqiladi. Sensor mavjud bo'lmasa — aniq sabab yoziladi."
      : 'Советы формируются по текущим, суточным и недельным данным. Если датчик отсутствует — указывается причина.' }),
    listBox,
    metaLine,
  ])]);

  load(true);   // fermer tabga kirganda — yangi tavsiya
  return node;
}

export default buildAiTab;
