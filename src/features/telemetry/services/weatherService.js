// ============================================================
//  features/telemetry/services/weatherService.js
//  Offline-first Weather Service for SmartLake.
//  Uses Open-Meteo (keyless, free) for real weather data.
//  Caches responses in localStorage for offline PWA compatibility.
//  Generates localized Uzbekistan summer climate fallbacks.
// ============================================================

import { logger } from '../../../core/logger.js';

// Simple weather code translator (WMO Code to readable labels)
function getWeatherLabel(code, locale = 'uz') {
  const isUz = locale === 'uz';
  const translations = {
    0: isUz ? 'Musaffo osmon' : 'Ясно',
    1: isUz ? 'Asosan ochiq' : 'Преимущественно ясно',
    2: isUz ? 'Qisman bulutli' : 'Переменная облачность',
    3: isUz ? 'Bulutli' : 'Пасмурно',
    45: isUz ? 'Tuman' : 'Туман',
    48: isUz ? 'Qirov tushishi' : 'Иней',
    51: isUz ? 'Mayda yomg\'ir' : 'Морось',
    53: isUz ? 'Mayda yomg\'ir' : 'Морось',
    55: isUz ? 'Kuchli mayda yomg\'ir' : 'Сильная морось',
    61: isUz ? 'Yomg\'ir' : 'Слабый дождь',
    63: isUz ? 'O\'rtacha yomg\'ir' : 'Дождь',
    65: isUz ? 'Kuchli yomg\'ir' : 'Сильный дождь',
    71: isUz ? 'Yengil qor' : 'Слабый снегопад',
    73: isUz ? 'Qor yog\'ishi' : 'Снегопад',
    75: isUz ? 'Kuchli qor' : 'Сильный снегопад',
    80: isUz ? 'Yengil jala yomg\'ir' : 'Ливень',
    81: isUz ? 'Jala yomg\'ir' : 'Сильный ливень',
    82: isUz ? 'Kuchli jala yomg\'ir' : 'Очень сильный ливень',
    95: isUz ? 'Momaqaldiroq' : 'Гроза',
    96: isUz ? 'Do\'l aralash momaqaldiroq' : 'Гроза с градом',
  };
  return translations[code] || (isUz ? 'O\'zgaruvchan' : 'Переменная');
}

// Map weather codes to simple icon ids
export function getWeatherIcon(code) {
  if (code === undefined || code === null) return 'sun';
  if ([0, 1].includes(code)) return 'sun';
  if ([2, 3].includes(code)) return 'cloud';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'waves'; // Let's use waves/water representation
  if ([95, 96].includes(code)) return 'bell'; // Alert/warning code
  return 'sun';
}

/**
 * Fallback generator for Uzbek districts during hot July season.
 */
function generateFallbackWeather(lake, locale = 'uz') {
  // July in Uzbekistan: High daytime temps (35 to 42°C), cool nights (20 to 26°C)
  const isUz = locale === 'uz';
  const nameHash = (lake.name || '').length + (lake.district || '').length;
  
  // Deterministic temperatures based on name hash so they stay steady for the lake
  const currentTemp = 32 + (nameHash % 7); // 32 - 38 °C
  const tomorrowTempMax = 35 + (nameHash % 6); // 35 - 40 °C
  const tomorrowTempMin = 21 + (nameHash % 5); // 21 - 25 °C
  const weatherCode = (nameHash % 10) === 0 ? 2 : 0; // 90% Sunny, 10% partly cloudy (summer typical)

  return {
    temp: currentTemp,
    tomorrowTempMax,
    tomorrowTempMin,
    code: weatherCode,
    label: getWeatherLabel(weatherCode, locale),
    tomorrowLabel: getWeatherLabel(weatherCode, locale),
    source: 'fallback',
    district: lake.district || (isUz ? 'Hududiy' : 'Региональный')
  };
}

/**
 * Fetches current weather and tomorrow's forecast for the given lake.
 * Works offline, caches in localStorage.
 */
export async function getLakeWeather(lake, locale = 'uz') {
  const cacheKey = `sl_weather_v2_${lake.id}`;
  
  // Try retrieving cached data first
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const age = Date.now() - parsed.ts;
      // Re-use cached value if it's less than 1 hour old or if we are offline
      if (age < 3600000 || !navigator.onLine) {
        return { ...parsed.data, isCached: true };
      }
    } catch (e) {
      logger.warn('Failed to parse cached weather', e);
    }
  }

  // Generate Uzbekistan fallbacks in case there are no coordinates
  if (!lake.coordinates || !lake.coordinates.lat || !lake.coordinates.lng) {
    const fallback = generateFallbackWeather(lake, locale);
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: fallback }));
    return fallback;
  }

  // Coordinates exist, attempt to fetch from Open-Meteo
  try {
    const { lat, lng } = lake.coordinates;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather API returned status ${res.status}`);
    
    const data = await res.json();
    
    const currentTemp = Math.round(data.current_weather.temperature);
    const currentCode = data.current_weather.weathercode;
    
    const tomorrowTempMax = data.daily && data.daily.temperature_2m_max ? Math.round(data.daily.temperature_2m_max[1]) : currentTemp + 2;
    const tomorrowTempMin = data.daily && data.daily.temperature_2m_min ? Math.round(data.daily.temperature_2m_min[1]) : currentTemp - 8;
    const tomorrowCode = data.daily && data.daily.weathercode ? data.daily.weathercode[1] : currentCode;

    const weatherResult = {
      temp: currentTemp,
      tomorrowTempMax,
      tomorrowTempMin,
      code: currentCode,
      label: getWeatherLabel(currentCode, locale),
      tomorrowLabel: getWeatherLabel(tomorrowCode, locale),
      source: 'api',
      district: lake.district || (locale === 'uz' ? 'Hududiy' : 'Региональный')
    };

    // Store in cache
    localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: weatherResult }));
    return weatherResult;
  } catch (err) {
    logger.warn('Error fetching weather from API, falling back', err);
    
    // If we have any cached data (even older than 1 hour), return it
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return { ...parsed.data, isCached: true };
      } catch (e) {}
    }

    // Otherwise generate clean climate fallback
    const fallback = generateFallbackWeather(lake, locale);
    return fallback;
  }
}
