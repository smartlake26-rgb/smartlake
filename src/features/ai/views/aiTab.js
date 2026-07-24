// ============================================================
//  features/ai/views/aiTab.js — AI Assistant Panel v3
//  3 ta Action Card + natija paneli (chat o'rniga)
// ============================================================

import { el, mount } from '../../../shared/dom.js';
import { toast } from '../../../shared/toast.js';
import { t, detectLocale } from '../../../core/i18n/index.js';
import { slIcon, slCard, slButton, slBadge } from '../../../design-system/index.js';
import { getAdvice } from '../aiService.js';
import { SENSOR_STATE, sensorStateI18nKey } from '../../telemetry/domain/sensorState.js';

const SEV = {
  crit: { color: '#D93025', bg: '#FEE8E7' },
  warn: { color: '#E8922A', bg: '#FFF3E0' },
  info: { color: '#2A8FC4', bg: '#E3F2FD' },
  ok:   { color: '#0E7C6B', bg: '#E8FAF6' },
};

export function buildAiTab({ isUz, getParams, onGoTab }) {
  let loading = false;
  let lastMode = null;

  const resultBox = el('div');
  const metaLine  = el('div', { style: 'font-size:10px;color:#8aa;text-align:center;margin-top:12px' });

  // ---- 3 ta ACTION CARD ----
  function actionCard(icon, title, desc, color, mode) {
    const card = el('div', {
      style: `background:var(--sl-card,#fff);border-radius:16px;padding:20px 16px;text-align:center;`
           + `cursor:pointer;border:1.5px solid transparent;transition:all .2s;box-shadow:0 1px 6px rgba(0,0,0,.04);`
           + `flex:1;min-width:0`,
      role: 'button', tabindex: '0',
    }, [
      el('div', { style: `width:40px;height:40px;border-radius:50%;background:${color}12;margin:0 auto 10px;`
                + `display:flex;align-items:center;justify-content:center` }, [
        el('span', { style: `color:${color}`, html: slIcon(icon, 22) }),
      ]),
      el('div', { style: 'font-size:13px;font-weight:700;color:var(--sl-on-surface,#1a2a3a);line-height:1.3', text: title }),
    ]);
    card.addEventListener('mouseenter', () => { card.style.borderColor = color; card.style.transform = 'translateY(-2px)'; card.style.boxShadow = `0 4px 16px ${color}20`; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'transparent'; card.style.transform = ''; card.style.boxShadow = '0 1px 6px rgba(0,0,0,.04)'; });
    card.addEventListener('click', () => runAnalysis(mode));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') runAnalysis(mode); });
    return card;
  }

  const actionsRow = el('div', { style: 'display:flex;gap:10px;margin-bottom:16px' }, [
    actionCard('activity', isUz ? "Ko'lni tahlil qil" : 'Анализ озера', '', '#0E7C6B', 'full'),
    actionCard('feed', isUz ? 'Yemni optimallashtir' : 'Оптимизация корма', '', '#2A8FC4', 'feed'),
    actionCard('bell', isUz ? 'Muammoni top' : 'Найти проблему', '', '#D93025', 'problem'),
  ]);

  // ---- TAHLIL ISHLATISH ----
  async function runAnalysis(mode) {
    if (loading) return;
    loading = true;
    lastMode = mode;

    // Skeleton
    mount(resultBox, el('div', { style: 'display:flex;flex-direction:column;gap:8px' }, [
      el('div', { style: 'height:80px;border-radius:14px;background:var(--sl-card-inset,#f5f7f8);animation:sl-ob-fade .5s ease infinite alternate' }),
      el('div', { style: 'height:60px;border-radius:14px;background:var(--sl-card-inset,#f5f7f8);animation:sl-ob-fade .5s ease .15s infinite alternate' }),
    ]));

    try {
      const params = getParams();
      const res = await getAdvice(params, { force: true, isUz });
      const ctx = res.context;
      const advices = res.advices || [];

      // Filtrlash: rejimga qarab
      let filtered = advices;
      if (mode === 'problem') {
        filtered = advices.filter((a) => a.severity === 'crit' || a.severity === 'warn');
        if (!filtered.length) filtered = [{ severity: 'ok', icon: 'activity', title: isUz ? 'Muammo topilmadi' : 'Проблем не найдено', text: isUz ? "Barcha ko'rsatkichlar me'yorda. Hozircha hech qanday choraga ehtiyoj yo'q." : 'Все показатели в норме.' }];
      } else if (mode === 'feed') {
        filtered = advices.filter((a) => a.icon === 'feed' || a.icon === 'sun' || (a.text && (a.text.includes('yem') || a.text.includes('корм') || a.text.includes('feed'))));
        if (!filtered.length) filtered = [{ severity: 'info', icon: 'feed', title: isUz ? 'Yem bo\'yicha tavsiya' : 'Рекомендация по корму', text: isUz ? "Hozirgi harorat va kislorod darajasida standart yem rejasi mos keladi. O'zgarish shart emas." : 'При текущих условиях стандартный режим кормления подходит.' }];
      }

      // Natija kartalari
      const cards = filtered.map((a) => {
        const sev = SEV[a.severity] || SEV.info;
        return el('div', {
          style: `background:var(--sl-card,#fff);border-radius:14px;padding:16px;border-left:4px solid ${sev.color};`
               + `box-shadow:0 1px 4px rgba(0,0,0,.03);margin-bottom:8px`,
        }, [
          // Sarlavha
          el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:8px' }, [
            el('div', { style: `width:32px;height:32px;border-radius:50%;background:${sev.bg};display:flex;align-items:center;justify-content:center;flex:none` }, [
              el('span', { style: `color:${sev.color}`, html: slIcon(a.icon || 'info', 16) }),
            ]),
            el('div', { style: `font-size:14px;font-weight:700;color:${sev.color}`, text: a.title }),
          ]),
          // Matn
          el('div', { style: 'font-size:13px;line-height:1.6;color:var(--sl-on-surface-variant,#3a5a6a);white-space:pre-line', text: a.text }),
          // Action tugma
          a.action ? el('div', { style: 'margin-top:10px' }, [
            el('button', {
              type: 'button',
              style: `padding:8px 16px;border-radius:10px;border:1.5px solid ${sev.color};background:transparent;`
                   + `color:${sev.color};font-size:12px;font-weight:600;cursor:pointer`,
              text: a.action.label,
              onClick: () => onGoTab && onGoTab(a.action.tab || 'holat'),
            }),
          ]) : null,
        ].filter(Boolean));
      });

      // Sensor holatlari
      const ss = ctx.sensorStates || {};
      const sensorInfo = ['do', 't', 'ph'].map((k) => {
        const st = ss[k];
        if (st === SENSOR_STATE.PRESENT) return null;
        const key = sensorStateI18nKey(st);
        return key ? t(key) : null;
      }).filter(Boolean);

      mount(resultBox, el('div', {}, [
        // Sensor ogohlantirishlari
        sensorInfo.length ? el('div', {
          style: 'background:#FFF8E1;border-radius:10px;padding:10px 14px;margin-bottom:10px;font-size:12px;color:#8a6d00;display:flex;gap:6px;align-items:flex-start',
        }, [
          el('span', { html: slIcon('info', 14), style: 'flex:none;margin-top:1px' }),
          el('span', { text: sensorInfo.join(' · ') }),
        ]) : null,
        // Natija kartalari
        ...cards,
      ].filter(Boolean)));

      metaLine.textContent = `${ctx.trend24h?.points || 0} ${isUz ? 'nuqta' : 'точек'} · ${ctx.devices?.online || 0}/${ctx.devices?.total || 0} ${isUz ? 'onlayn' : 'онлайн'} · ${res.providerName}`;

    } catch (e) {
      mount(resultBox, el('div', {
        style: 'background:#FEE;border-radius:12px;padding:16px;color:#D93025;font-size:13px',
        text: (e && e.message) || 'Xato',
      }));
    } finally { loading = false; }
  }

  // ---- ASOSIY NODE ----
  const node = el('div', { style: 'padding:4px 0' }, [
    // Sarlavha
    el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:16px' }, [
      el('div', { style: 'width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0E7C6B,#14A8C0);display:flex;align-items:center;justify-content:center;flex:none' }, [
        el('span', { style: 'color:#fff', html: slIcon('sparkles', 18) }),
      ]),
      el('div', {}, [
        el('div', { style: 'font-size:16px;font-weight:800;color:var(--sl-on-surface,#1a2a3a)', text: isUz ? 'AI Yordamchi' : 'AI Помощник' }),
        el('div', { style: 'font-size:11px;color:var(--sl-text-secondary,#8aa)', text: isUz ? 'Bir bosishda tahlil va tavsiya' : 'Анализ и рекомендации в одно касание' }),
      ]),
    ]),

    // 3 ta action card
    actionsRow,

    // Natija
    resultBox,
    metaLine,
  ]);

  // Birinchi ochilganda avtomatik to'liq tahlil
  runAnalysis('full');

  return node;
}

export default buildAiTab;
