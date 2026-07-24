// ============================================================
//  farmer/onboarding.js — Onboarding v2 (yengil, zamonaviy)
// ============================================================

import { el, mount } from '../shared/dom.js';
import { detectLocale } from '../core/i18n/index.js';

export function renderOnboarding(uid, onComplete) {
  const isUz = detectLocale() === 'uz';
  let active = 0;

  const SLIDES = [
    {
      icon: 'waves',
      color: '#0E7C6B',
      bg: 'linear-gradient(135deg, #E8FAF6 0%, #D0F0EA 100%)',
      title: isUz ? 'SmartLake ga xush kelibsiz' : 'Добро пожаловать в SmartLake',
      desc: isUz
        ? "Baliq ko'llaringizni 24/7 masofadan kuzating. Suv sifati, harorat va kislorod darajasi doim nazoratda."
        : 'Мониторинг ваших прудов 24/7. Качество воды, температура и кислород всегда под контролем.',
      visual: () => el('div', { style: 'display:flex;justify-content:center;gap:16px;margin:16px 0' }, [
        miniCard('#0E7C6B', 'DO', '7.8', 'mg/L'),
        miniCard('#E8672A', '°C', '24', ''),
        miniCard('#2A8FC4', 'pH', '7.4', ''),
      ]),
    },
    {
      icon: 'activity',
      color: '#2A8FC4',
      bg: 'linear-gradient(135deg, #E8F4FC 0%, #D0ECFA 100%)',
      title: isUz ? 'Real vaqtda kuzatuv' : 'Мониторинг в реальном времени',
      desc: isUz
        ? "Sensorlar har daqiqada ma'lumot yuboradi. Kislorod tushsa — darhol ogohlantirish olasiz. Aeratorni ilovadan boshqaring."
        : 'Датчики отправляют данные каждую минуту. При падении кислорода — мгновенное оповещение.',
      visual: () => {
        const pts = [40,35,38,25,30,22,28,32,36,30,26,20,24,30,35,32];
        const w = 260, h = 80, px = w / (pts.length - 1);
        const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * px},${h - v * 2}`).join(' ');
        return el('div', { style: 'display:flex;justify-content:center;margin:20px 0' }, [
          el('div', {
            style: 'background:#fff;border-radius:16px;padding:16px 20px;box-shadow:0 2px 12px rgba(0,0,0,.06);width:280px',
            html: `<div style="font-size:11px;color:#8aa;margin-bottom:8px;font-weight:600">${isUz ? 'Kislorod (DO) — oxirgi 24 soat' : 'Кислород (DO) — 24ч'}</div>
              <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
                <path d="${d}" fill="none" stroke="#0E7C6B" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
                <line x1="0" y1="${h - 20}" x2="${w}" y2="${h - 20}" stroke="#E8672A" stroke-width="1" stroke-dasharray="4,3" opacity=".5"/>
                <text x="${w - 2}" y="${h - 22}" font-size="9" fill="#E8672A" text-anchor="end" font-family="sans-serif">min</text>
                ${pts.map((v, i) => `<circle cx="${i * px}" cy="${h - v * 2}" r="3" fill="#0E7C6B" stroke="#fff" stroke-width="1.5"/>`).join('')}
              </svg>`,
          }),
        ]);
      },
    },
    {
      icon: 'bell',
      color: '#E8672A',
      bg: 'linear-gradient(135deg, #FFF4EE 0%, #FFE8DA 100%)',
      title: isUz ? 'Ogohlantirish va AI tavsiya' : 'Оповещения и AI-советы',
      desc: isUz
        ? "Muammo bo'lsa telefoningizga darhol xabar keladi. AI sensor ma'lumotlarini tahlil qilib, nima qilish kerakligini aytadi."
        : 'При проблемах — мгновенное уведомление на телефон. AI анализирует данные и даёт рекомендации.',
      visual: () => el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin:16px auto;max-width:280px' }, [
        alertRow('#E8672A', isUz ? '🚨 Kislorod kritik — 2.8 mg/L' : '🚨 Кислород критический — 2.8 мг/л', isUz ? 'Hozir' : 'Сейчас'),
        alertRow('#2A8FC4', isUz ? '💡 Aeratorni AUTO rejimga qo\'ying' : '💡 Включите аэратор в режим AUTO', 'AI'),
        alertRow('#0E7C6B', isUz ? '✅ Kislorod normaga qaytdi — 6.2' : '✅ Кислород в норме — 6.2', isUz ? '15 daq' : '15 мин'),
      ]),
    },
    {
      icon: 'plus',
      color: '#0E7C6B',
      bg: 'linear-gradient(135deg, #E8FAF6 0%, #D8F2ED 100%)',
      title: isUz ? 'Boshlash oson' : 'Начать легко',
      desc: isUz
        ? "1. Ko'l qo'shing\n2. Qurilmani QR kod bilan ulang\n3. Ma'lumotlar avtomatik keladi"
        : '1. Добавьте озеро\n2. Подключите устройство по QR\n3. Данные поступают автоматически',
      visual: () => el('div', { style: 'display:flex;flex-direction:column;gap:10px;margin:16px auto;max-width:260px' }, [
        stepRow(1, '#0E7C6B', isUz ? "Ko'l qo'shish" : 'Добавить озеро', 'droplet'),
        stepRow(2, '#2A8FC4', isUz ? 'Qurilma ulash' : 'Подключить устройство', 'link'),
        stepRow(3, '#E8672A', isUz ? 'Kuzatishni boshlash' : 'Начать мониторинг', 'activity'),
      ]),
    },
  ];

  // Yordamchi komponentlar
  function miniCard(color, label, value, unit) {
    return el('div', {
      style: `text-align:center;padding:16px 14px;border-radius:14px;background:#fff;`
           + `box-shadow:0 2px 10px rgba(0,0,0,.05);min-width:72px`,
    }, [
      el('div', { style: `font-size:11px;color:${color};font-weight:700;margin-bottom:4px`, text: label }),
      el('div', { style: 'font-size:26px;font-weight:800;color:#1a3a4a;line-height:1', text: value }),
      unit ? el('div', { style: 'font-size:10px;color:#8aa;margin-top:2px', text: unit }) : null,
    ].filter(Boolean));
  }

  function alertRow(color, text, time) {
    return el('div', {
      style: `display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:12px;`
           + `background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.04);border-left:3px solid ${color}`,
    }, [
      el('div', { style: 'flex:1;font-size:13px;font-weight:600;color:#1a3a4a;line-height:1.4', text }),
      el('div', { style: 'font-size:10px;color:#8aa;white-space:nowrap', text: time }),
    ]);
  }

  function stepRow(num, color, text, ic) {
    return el('div', {
      style: 'display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:14px;'
           + 'background:#fff;box-shadow:0 1px 8px rgba(0,0,0,.04)',
    }, [
      el('div', {
        style: `width:36px;height:36px;border-radius:50%;background:${color};color:#fff;`
             + 'display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex:none',
        text: String(num),
      }),
      el('div', { style: 'font-size:14px;font-weight:600;color:#1a3a4a', text }),
    ]);
  }

  // DOM
  const slideBox = el('div');
  const dotsRow = el('div', { style: 'display:flex;justify-content:center;gap:8px;margin-top:auto;padding-top:24px' });
  const btnRow = el('div', { style: 'display:flex;gap:10px;padding:8px 0 16px' });

  function done() {
    try { localStorage.setItem('sl_onboarded_' + uid, 'true'); } catch (_) {}
    onComplete();
  }

  function render() {
    const s = SLIDES[active];
    const isLast = active === SLIDES.length - 1;

    // Slide
    mount(slideBox, el('div', {
      style: 'animation:sl-ob-fade .3s ease both',
    }, [
      // Icon
      el('div', { style: 'display:flex;justify-content:center;margin-bottom:16px' }, [
        el('div', {
          style: `width:56px;height:56px;border-radius:50%;background:${s.color};`
               + 'display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.1)',
          innerHTML: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            ${s.icon === 'waves' ? '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>'
            : s.icon === 'activity' ? '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'
            : s.icon === 'bell' ? '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
            : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'}
          </svg>`,
        }),
      ]),
      // Title
      el('h2', {
        style: 'text-align:center;font-size:22px;font-weight:800;color:#1a3a4a;margin:0 0 8px;line-height:1.3',
        text: s.title,
      }),
      // Desc
      el('p', {
        style: 'text-align:center;font-size:14px;line-height:1.6;color:#5a7a8a;margin:0 0 8px;white-space:pre-line',
        text: s.desc,
      }),
      // Visual
      s.visual(),
    ]));

    // Dots
    mount(dotsRow, ...SLIDES.map((_, i) =>
      el('button', {
        type: 'button',
        style: `width:${i === active ? '24px' : '8px'};height:8px;border-radius:4px;border:none;padding:0;cursor:pointer;`
             + `background:${i === active ? s.color : '#d0dde2'};transition:all .25s`,
        onClick: () => { active = i; render(); },
      })
    ));

    // Buttons
    mount(btnRow, ...[
      active > 0
        ? el('button', {
            type: 'button',
            style: 'padding:14px 20px;border-radius:14px;border:1.5px solid #d0dde2;background:#fff;'
                 + 'color:#5a7a8a;font-size:14px;font-weight:600;cursor:pointer',
            text: isUz ? 'Orqaga' : 'Назад',
            onClick: () => { active--; render(); },
          })
        : el('button', {
            type: 'button',
            style: 'padding:14px 20px;border-radius:14px;border:none;background:transparent;'
                 + 'color:#8aa;font-size:14px;font-weight:500;cursor:pointer',
            text: isUz ? "O'tkazish" : 'Пропустить',
            onClick: done,
          }),
      el('button', {
        type: 'button',
        style: `flex:1;padding:14px 20px;border-radius:14px;border:none;font-size:15px;font-weight:700;`
             + `cursor:pointer;color:#fff;background:${s.color};box-shadow:0 4px 14px ${s.color}33;transition:all .2s`,
        text: isLast ? (isUz ? 'Boshlash' : 'Начать') : (isUz ? 'Keyingi' : 'Далее'),
        onClick: () => { if (isLast) done(); else { active++; render(); } },
      }),
    ]);
  }

  // Style
  if (!document.getElementById('sl-ob-css')) {
    const css = document.createElement('style');
    css.id = 'sl-ob-css';
    css.textContent = '@keyframes sl-ob-fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}';
    document.head.appendChild(css);
  }

  const root = el('div', {
    style: 'min-height:100dvh;display:flex;flex-direction:column;padding:32px 20px 20px;'
         + 'background:linear-gradient(180deg,#F4FAFB 0%,#E8F4F6 100%);font-family:var(--sans)',
  }, [slideBox, dotsRow, btnRow]);

  render();

  // Swipe
  let sx = null;
  root.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && active < SLIDES.length - 1) { active++; render(); }
      if (dx > 0 && active > 0) { active--; render(); }
    }
  }, { passive: true });

  return root;
}
