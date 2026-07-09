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
    analysisBlock,
    recsHeader,
    recsList,
    weatherRow
  ]);

  return card;
}

export default aiAdvisorCard;
