// ============================================================
//  features/telemetry/domain/predictiveAdvisor.js
//  Offline-first Smart AI Advisor & Predictive Warning System.
//  Runs entirely client-side, making it perfect for remote locations.
// ============================================================

import { aggregateLake } from './aggregate.js';
import { resolveThresholds } from './thresholds.js';
import { DEVICE_STATUS } from '../constants/telemetryConstants.js';

/**
 * Generates smart, predictive advice based on current sensor metrics, time of day, and weather forecast.
 * 
 * @param {object} lake - The lake object
 * @param {Array} devs - Devices assigned to this lake
 * @param {Map|object} telemetry - Telemetry mapping
 * @param {string} locale - Current locale ('uz' or 'ru')
 * @param {Date} [now] - Reference time
 * @param {object} [weather] - Weather data object
 * @returns {object} { status, title, analysis, recommendations, trend }
 */
export function generateSmartAdvice(lake, devs, telemetry, locale = 'uz', now = new Date(), weather = null) {
  const th = resolveThresholds(lake);
  const a = aggregateLake(devs, telemetry, th, now.getTime());
  const hour = now.getHours();
  
  const isUz = locale === 'uz';

  const texts = {
    uz: {
      title: "Aqlli AI Maslahatchi",
      noData: "Ko'ldan datchik ma'lumotlari kelmadi. Iltimos, datchiklarni ulab faollashtiring.",
      stable: "Tizim barqaror va barcha ko'rsatkichlar me'yorida.",
      doCrit: "FAVQU_LODDA! Kislorod darajasi o'ta past ({do} mg/L). Baliqlar bo'g'ilish xavfi ostida! Zudlik bilan aeratorni ishga tushiring.",
      doWarn: "DIQQAT! Kislorod miqdori kamaygan ({do} mg/L). Kechasi yoki tongda bu ko'rsatkich kritik darajaga tushishi mumkin. Aeratorni 15-30 daqiqaga yoqish tavsiya qilinadi.",
      doNight: "DIQQAT! Hozir soat {hour}:00 (kechki vaqt). Quyosh botgandan so'ng suvda kislorod tabiiy ravishda pasayadi. {do} mg/L kislorod bilan tunni o'tkazish xavfli bo'lishi mumkin. Aeratorni avtomatik rejimga yoki 1 soatga yoqishni tavsiya qilaman.",
      tempHigh: "DIQQAT! Suv harorati yuqori ({temp}°C). Issiq suvda kislorod qiyin eriydi. Aerator ishlash vaqtini uzaytirish tavsiya etiladi.",
      tempLow: "DIQQAT! Suv harorati past ({temp}°C). Baliqlarning hazm qilish tizimi sekinlashadi. Yem berish miqdorini kamaytiring.",
      phHigh: "DIQQAT! pH ko'rsatkichi juda yuqori ({ph}). Ishqoriy muhit baliq terisini shikastlashi mumkin. Suv almashinuvini ta'minlang.",
      phLow: "DIQQAT! pH ko'rsatkichi juda past ({ph}). Kislotali muhit baliqlar salomatligi uchun xavfli. Ko'lni ohaklashni ko'rib chiqing.",
      offlineTrend: "Ilova offline rejimda ishlamoqda. Keshdagi oxirgi ma'lumot tahlil qilindi.",
      recAeratorOn: "Aeratorni faollashtiring (15-30 daqiqa)",
      recPhAdjust: "Suv almashinuvini yoki pH muvozanatini tekshiring",
      recFeedReduce: "Yem miqdorini 30-50% ga kamaytiring",
      recCheckWifi: "Qurilma ulanishi va batareyasini tekshiring",
      recAllOk: "Muntazam ravishda datchiklar tozaligini saqlang",
      
      // Weather predictive texts
      weatherHotAdvice: "Ertaga kun o'ta issiq ({temp}°C) bo'lishi kutilmoqda. Issiq havoda suvda kislorod juda tez pasayadi. Bugun kechki payt va ertaga tushdan keyin aeratorni uzoqroq muddatga yoqib turing.",
      weatherRainAdvice: "Ertaga yog'ingarchilik kutilmoqda ({label}, {temp}°C). Yomg'ir ko'ldagi pH muvozanati va datchiklar ishiga ta'sir qilishi mumkin. Aerator rejimini avtomatda qoldiring va yem berishni 20% ga kamaytiring.",
      weatherColdAdvice: "Ertaga havo harorati pasayishi kutilmoqda ({temp}°C). Baliqlarning faolligi va moddalar almashinuvi sekinlashadi, shuning uchun yem miqdorini kamaytiring."
    },
    ru: {
      title: "Умный AI Консультант",
      noData: "Данные от датчиков отсутствуют. Пожалуйста, подключите и активируйте устройства.",
      stable: "Система стабильна, все показатели в пределах нормы.",
      doCrit: "КРИТИЧЕСКИЙ УРОВЕНЬ! Кислород критически низок ({do} мг/л). Рыба под угрозой удушья! Срочно включите аэратор.",
      doWarn: "ВНИМАНИЕ! Кислород понижен ({do} мг/л). Ночью или утром этот показатель может упасть ниже нормы. Рекомендуется включить аэратор на 15-30 минут.",
      doNight: "ВНИМАНИЕ! Сейчас {hour}:00 (вечернее время). После захода солнца кислород снижается быстрее. С уровнем {do} мг/л проводить ночь опасно. Рекомендуется включить аэратор на 1 час или активировать авто-режим.",
      tempHigh: "ВНИМАНИЕ! Температура воды высокая ({temp}°C). В теплой воде кислород растворяется хуже. Рекомендуется увеличить время работы аэратора.",
      tempLow: "ВНИМАНИЕ! Температура воды низкая ({temp}°C). Пищеварение рыб замедляется. Сократите объем корма.",
      phHigh: "ВНИМАНИЕ! pH уровень слишком высокий ({ph}). Щелочная среда может повредить кожу рыб. Обеспечьте проточность воды.",
      phLow: "ВНИМАНИЕ! pH уровень слишком низкий ({ph}). Кислая среда опасна для здоровья рыб. Рассмотрите известкование пруда.",
      offlineTrend: "Приложение работает офлайн. Проанализированы последние кэшированные данные.",
      recAeratorOn: "Включите аэратор (на 15-30 минут)",
      recPhAdjust: "Проверьте циркуляцию воды и уровень pH",
      recFeedReduce: "Уменьшите количество корма на 30-50%",
      recCheckWifi: "Проверьте связь и батарею устройства",
      recAllOk: "Регулярно очищайте датчики от ила и водорослей",

      // Weather predictive texts
      weatherHotAdvice: "Завтра ожидается экстремально жаркая погода ({temp}°C). В жару уровень кислорода в воде падает лавинообразно. Рекомендуется продлить работу аэратора сегодня вечером и завтра днем.",
      weatherRainAdvice: "Завтра прогнозируются осадки ({label}, {temp}°C). Дождь может сбить баланс pH и повлиять на показания датчиков. Держите аэратор в авто-режиме и снизьте кормление на 20%.",
      weatherColdAdvice: "Завтра ожидается прохладная погода ({temp}°C). У рыб снизится активность и обмен веществ, рекомендуется уменьшить суточную норму корма."
    }
  };

  const t = texts[locale] || texts.uz;

  // No active telemetry data
  if (a.avgDo === null && a.avgTemp === null && a.avgPh === null) {
    return {
      status: 'warning',
      title: t.title,
      analysis: t.noData,
      recommendations: [t.recCheckWifi],
      trend: 'none'
    };
  }

  const recommendations = [];
  let analysis = t.stable;
  let status = 'healthy';
  let trend = 'stable';

  // 1. Oxygen (DO) analysis
  if (a.avgDo !== null) {
    if (a.avgDo < th.do.crit) {
      status = 'critical';
      trend = 'danger';
      analysis = t.doCrit.replace('{do}', String(a.avgDo));
      recommendations.push(t.recAeratorOn);
    } else if (a.avgDo < th.do.warn) {
      status = 'warning';
      trend = 'falling';
      analysis = t.doWarn.replace('{do}', String(a.avgDo));
      recommendations.push(t.recAeratorOn);
    } else if (a.avgDo < 5.8 && (hour >= 18 || hour < 6)) {
      // Evening/Night warning even if within slight safe limits
      status = 'warning';
      trend = 'nocturnal';
      analysis = t.doNight.replace('{do}', String(a.avgDo)).replace('{hour}', String(hour));
      recommendations.push(t.recAeratorOn);
    }
  }

  // 2. Temperature analysis
  if (a.avgTemp !== null) {
    if (a.avgTemp > th.temp.warnMax) {
      if (status !== 'critical') status = 'warning';
      analysis += " " + t.tempHigh.replace('{temp}', String(a.avgTemp));
      if (!recommendations.includes(t.recAeratorOn)) recommendations.push(t.recAeratorOn);
    } else if (a.avgTemp < th.temp.warnMin) {
      if (status !== 'critical') status = 'warning';
      analysis += " " + t.tempLow.replace('{temp}', String(a.avgTemp));
      recommendations.push(t.recFeedReduce);
    }
  }

  // 3. pH analysis
  if (a.avgPh !== null) {
    if (a.avgPh > th.ph.warnMax) {
      if (status !== 'critical') status = 'warning';
      analysis += " " + t.phHigh.replace('{ph}', String(a.avgPh));
      recommendations.push(t.recPhAdjust);
    } else if (a.avgPh < th.ph.warnMin) {
      if (status !== 'critical') status = 'warning';
      analysis += " " + t.phLow.replace('{ph}', String(a.avgPh));
      recommendations.push(t.recPhAdjust);
    }
  }

  // 4. Weather predictive integration
  if (weather) {
    // High heat forecast
    if (weather.tomorrowTempMax >= 37) {
      if (status === 'healthy') status = 'warning';
      analysis = t.weatherHotAdvice.replace('{temp}', String(weather.tomorrowTempMax)) + " " + analysis;
      if (!recommendations.includes(t.recAeratorOn)) {
        recommendations.unshift(t.recAeratorOn);
      }
    }
    // Rain/Storm forecast (Codes: 51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96)
    else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96].includes(weather.code)) {
      analysis = t.weatherRainAdvice.replace('{temp}', String(weather.tomorrowTempMax)).replace('{label}', weather.tomorrowLabel) + " " + analysis;
      recommendations.push(t.recFeedReduce);
    }
    // Cold forecast
    else if (weather.tomorrowTempMax <= 24) {
      analysis = t.weatherColdAdvice.replace('{temp}', String(weather.tomorrowTempMax)) + " " + analysis;
      recommendations.push(t.recFeedReduce);
    }
  }

  // Add a fallback recommendation if everything is healthy
  if (recommendations.length === 0) {
    recommendations.push(t.recAllOk);
  }

  // Check network status to append offline notice
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    analysis += " — " + t.offlineTrend;
  }

  return {
    status,
    title: t.title,
    analysis,
    recommendations,
    trend
  };
}

export default generateSmartAdvice;
