// ============================================================
//  features/telemetry/components/aiAdvisorCard.js
//  Render bento-style card for the Smart AI Advisor.
//  Works 100% offline-first. Fully localized (uz/ru).
// ============================================================

import { el } from '../../../shared/dom.js';
import { icon } from '../../../shared/icons.js';
import { detectLocale } from '../../../core/i18n/index.js';
import { generateSmartAdvice } from '../domain/predictiveAdvisor.js';
import { getWeatherIcon } from '../services/weatherService.js';

/**
 * Creates a beautiful Bento Card for the AI Advisor.
 * 
 * @param {object} props - { lake, devs, telemetry, weather }
 * @returns {HTMLElement} - The fully rendered advisor card Node.
 */
export function aiAdvisorCard({ lake, devs, telemetry, weather }) {
  const locale = detectLocale();
  const advice = generateSmartAdvice(lake, devs, telemetry, locale, new Date(), weather);

  const statusColors = {
    critical: {
      border: '1px solid var(--md-critical)',
      bg: 'color-mix(in srgb, var(--md-critical) 8%, var(--md-surface-container-low))',
      glow: '0 0 12px color-mix(in srgb, var(--md-critical) 15%, transparent)',
      textColor: 'var(--md-critical)',
      icon: 'bell'
    },
    warning: {
      border: '1px solid var(--md-warning)',
      bg: 'color-mix(in srgb, var(--md-warning) 10%, var(--md-surface-container-low))',
      glow: '0 0 10px color-mix(in srgb, var(--md-warning) 15%, transparent)',
      textColor: 'var(--md-warning)',
      icon: 'info'
    },
    healthy: {
      border: '1px solid var(--md-success)',
      bg: 'color-mix(in srgb, var(--md-success) 6%, var(--md-surface-container-low))',
      glow: 'none',
      textColor: 'var(--md-success)',
      icon: 'activity'
    }
  };

  const styleConfig = statusColors[advice.status] || statusColors.healthy;

  // Header element
  const header = el('div', { 
    style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px' 
  }, [
    el('div', { style: 'display:flex;align-items:center;gap:8px' }, [
      el('div', { 
        style: `display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:color-mix(in srgb, ${styleConfig.textColor} 20%, transparent);color:${styleConfig.textColor}`,
        html: icon(styleConfig.icon, 18)
      }),
      el('span', { 
        style: 'font-weight:700;font-size:15px;letter-spacing:-0.2px', 
        text: advice.title 
      })
    ]),
    el('span', { 
      class: 't-label', 
      style: `font-size:10px;text-transform:uppercase;padding:2px 8px;border-radius:12px;background:color-mix(in srgb, ${styleConfig.textColor} 15%, transparent);color:${styleConfig.textColor};font-weight:800`,
      text: locale === 'uz' ? 'AI TAHLIL' : 'AI АНАЛИЗ'
    })
  ]);

  // Feeding recommendation block (Highest priority)
  let feedingBlock = null;
  const feed = advice.feeding;
  
  if (feed && feed.success) {
    const isZero = feed.recommendedFeed === 0;
    feedingBlock = el('div', {
      style: `margin-bottom:14px; padding:12px; border-radius:12px; background:color-mix(in srgb, var(--md-tertiary) ${isZero ? '12%' : '8%'}, var(--md-surface-container-high)); border:1px solid ${isZero ? 'var(--md-critical)' : 'var(--md-tertiary-outline, var(--md-outline-variant))'}`
    }, [
      el('div', { style: 'display:flex; align-items:center; gap:6px; margin-bottom:6px' }, [
        el('span', { html: icon('sun', 14), style: 'color:var(--md-tertiary); display:inline-flex' }),
        el('span', { style: 'font-size:11px; font-weight:700; color:var(--md-tertiary); text-transform:uppercase; letter-spacing:0.5px', text: 'Ertangi yem berish tavsiyasi' })
      ]),
      isZero ? el('div', {}, [
        el('div', { style: 'font-size:16px; font-weight:800; color:var(--md-critical)' }, [
          el('span', { text: "Yem bermaslik tavsiya etiladi!" })
        ]),
        el('div', { style: 'font-size:11px; margin-top:4px; font-weight:500; color:var(--md-on-surface-variant)', text: "Suvdagi erigan kislorod miqdori o'ta kam bo'lganligi sababli, baliqlar bo'g'ilishining oldini olish uchun yem berishni to'xtatib turing." })
      ]) : el('div', {}, [
        el('div', { style: 'font-size:22px; font-weight:800; color:var(--md-tertiary)' }, [
          el('span', { text: `${feed.recommendedFeed} kg` }),
          el('span', { style: 'font-size:12px; font-weight:500; color:var(--md-on-surface-variant)', text: ' (Sutkalik me\'yor)' })
        ]),
        el('div', { style: 'font-size:11px; margin-top:4px; font-weight:500; color:var(--md-on-surface-variant)' }, [
          el('span', { html: `Jami baliq massasi: <b>${feed.totalBiomass} kg</b> | Me'yor: <b>${feed.ratePercent}%</b>` })
        ])
      ])
    ]);
  } else {
    feedingBlock = el('div', {
      style: 'margin-bottom:14px; padding:10px 12px; border-radius:10px; background:color-mix(in srgb, var(--md-outline) 4%, var(--md-surface-container-high)); border:1px solid var(--md-outline-variant)'
    }, [
      el('div', { style: 'display:flex; align-items:center; gap:6px; margin-bottom:4px' }, [
        el('span', { html: icon('info', 14), style: 'color:var(--md-outline); display:inline-flex' }),
        el('span', { style: 'font-size:11px; font-weight:700; color:var(--md-on-surface-variant); text-transform:uppercase; letter-spacing:0.5px', text: 'Yem miqdori kalkulyatori' })
      ]),
      el('div', { style: 'font-size:11px; font-weight:500; color:var(--md-on-surface-variant)', text: 'Ertangi yem berish miqdorini aniq hisoblash uchun ko\'l sozlamalarida baliq turlari va ularning sonini to\'ldiring.' })
    ]);
  }

  // Description / analysis block
  const analysisBlock = el('div', { 
    style: 'font-size:13.5px;line-height:1.45;font-weight:500;margin-bottom:12px;color:var(--md-on-surface)' 
  }, [
    el('p', { text: advice.analysis })
  ]);

  // Recommendations header
  const recsHeader = el('div', { 
    style: 'font-size:11px;text-transform:uppercase;font-weight:700;color:var(--md-on-surface-variant);margin-bottom:6px;letter-spacing:0.5px',
    text: locale === 'uz' ? "Amaliy tavsiyalar:" : "Рекомендации:"
  });

  // Action items / Recommendations list
  const recsList = el('div', { 
    style: 'display:flex;flex-direction:column;gap:6px' 
  }, advice.recommendations.map(rec => {
    return el('div', { 
      style: 'display:flex;align-items:flex-start;gap:8px;font-size:12.5px;line-height:1.35;font-weight:500;color:var(--md-on-surface-variant)' 
    }, [
      el('span', { 
        style: `display:inline-flex;color:${styleConfig.textColor};margin-top:2px`,
        html: icon('check', 14)
      }),
      el('span', { text: rec })
    ]);
  }));

  // Render weather row at the bottom if loaded
  let weatherRow = null;
  if (weather) {
    const isUz = locale === 'uz';
    const weatherIconName = getWeatherIcon(weather.code);
    weatherRow = el('div', {
      style: 'margin-top:12px;padding-top:12px;border-top:1px dashed var(--md-outline-variant);display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:600;color:var(--md-on-surface-variant)'
    }, [
      el('div', { style: 'display:flex;align-items:center;gap:6px' }, [
        el('span', { html: icon(weatherIconName, 16), style: 'color:var(--md-primary);display:inline-flex' }),
        el('span', { text: `${weather.district}: ${weather.temp}°C (${weather.label})` })
      ]),
      el('span', {
        style: 'font-size:11px;opacity:0.85;font-weight:700',
        text: isUz ? `Ertaga: ${weather.tomorrowTempMax}°C (${weather.tomorrowLabel})` : `Завтра: ${weather.tomorrowTempMax}°C (${weather.tomorrowLabel})`
      })
    ]);
  }

  // Outer Bento card wrapper
  const card = el('div', {
    class: 'md-card anim-up ai-glowing-card',
    style: `border:${styleConfig.border};background:${styleConfig.bg};box-shadow:${styleConfig.glow};padding:16px;margin-bottom:16px`
  }, [
    header,
    feedingBlock,
    analysisBlock,
    recsHeader,
    recsList,
    weatherRow
  ]);

  return card;
}

export default aiAdvisorCard;
