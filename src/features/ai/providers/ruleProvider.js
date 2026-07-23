// ============================================================
//  features/ai/providers/ruleProvider.js — LOKAL QOIDALAR DVIGATELI
//  (D-bosqich). Hozir ISHLAYDIGAN provider: internet/APIsiz, ko'l
//  ma'lumotlarini tahlil qilib amaliy tavsiyalar beradi. Sof
//  funksiya — unit-testlar bilan qoplangan.
// ============================================================

import { normalizeAdvice } from './providerInterface.js';
import { SENSOR_STATE } from '../../telemetry/domain/sensorState.js';

/* Sensor holati -> i18n kaliti (ruleProvider ichida stringlar) */
const STATE_REASON = {
  uz: {
    [SENSOR_STATE.ABSENT]:       "o'rnatilmagan",
    [SENSOR_STATE.DISCONNECTED]: 'aloqa uzilgan',
    [SENSOR_STATE.DISABLED]:     "o'chirilgan",
    [SENSOR_STATE.FAULTY]:       'nosoz',
    [SENSOR_STATE.CALIBRATION]:  'kalibrovka kerak',
  },
  ru: {
    [SENSOR_STATE.ABSENT]:       'не установлен',
    [SENSOR_STATE.DISCONNECTED]: 'нет связи',
    [SENSOR_STATE.DISABLED]:     'отключён',
    [SENSOR_STATE.FAULTY]:       'неисправен',
    [SENSOR_STATE.CALIBRATION]:  'требует калибровки',
  },
};

/** ctx asosida tavsiyalar (sinxron mantiq, async interfeys uchun o'raladi). */
export function evaluateRules(ctx, isUz = true) {
  const A = [];
  const th = ctx.thresholds || { do: { crit: 3, warn: 5 }, temp: { warnMax: 30 }, battery: { warn: 30 } };
  const now = ctx.now || {};
  const tr = ctx.trend24h || {};
  const wk = ctx.week || {};
  const ss = ctx.sensorStates || {};   // sensor holatlari
  const lang = isUz ? 'uz' : 'ru';
  const reason = STATE_REASON[lang];

  // ---- YordAmchi: holat sababi matni ----
  const sensorNote = (key, label) => {
    const st = ss[key];
    if (!st || st === SENSOR_STATE.PRESENT) return null;
    const why = reason[st] || st;
    return isUz
      ? `${label} sensori ${why} — bu parametr bo'yicha tavsiya shakllantirib bo'lmadi.`
      : `Датчик ${label} ${why} — рекомендации по этому параметру не сформированы.`;
  };

  // ---- Sensorlar holati qaydlari (chalg'ituvchi emas, ma'lumot uchun) ----
  const doNote  = sensorNote('do', isUz ? 'Kislorod (DO)' : 'Кислород (DO)');
  const phNote  = sensorNote('ph', 'pH');
  const tNote   = sensorNote('t', isUz ? 'Harorat' : 'Температура');
  const badNotes = [doNote, phNote, tNote].filter(Boolean);

  // Hech bir asosiy sensor ishlamayapti
  const doOk   = ss.do  === SENSOR_STATE.PRESENT;
  const tempOk = ss.t   === SENSOR_STATE.PRESENT;
  const phOk   = ss.ph  === SENSOR_STATE.PRESENT;
  const hasSome = doOk || tempOk || phOk;

  if (!hasSome && ctx.devices && ctx.devices.total > 0 && ctx.devices.online === 0) {
    // Qurilmalar butunlay oflayn
    A.push({ severity: 'crit', icon: 'wifi',
      title: isUz ? 'Barcha qurilmalar oflayn' : 'Все устройства офлайн',
      text: isUz
        ? "Ko'ldan ma'lumot kelmayapti — gateway va qurilma quvvatini, LoRa antennasini tekshiring."
        : 'Нет данных — проверьте питание и антенну.' });
    return A.map(normalizeAdvice);
  }

  if (!hasSome) {
    // Qurilmalar bor, lekin hech bir asosiy sensor ishlamayapti
    A.push({ severity: 'warn', icon: 'info',
      title: isUz ? "Sensor ma'lumotlari yo'q" : 'Данные датчиков недоступны',
      text: isUz
        ? "Hech bir asosiy sensordan (DO, harorat, pH) ishonchli ma'lumot kelmayapti. Sensorlar holatini tekshiring."
        : 'Нет надёжных данных ни от одного основного датчика. Проверьте состояние датчиков.' });
    return A.map(normalizeAdvice);
  }

  // ---- 1) DO — faqat sensor PRESENT bo'lsa hisoblanadi ----
  if (doOk) {
    if (now.do != null && now.do < th.do.crit) {
      A.push({ severity: 'crit', icon: 'waves',
        title: isUz ? 'Kislorod KRITIK darajada!' : 'Кислород КРИТИЧЕСКИ низкий!',
        text: isUz ? `Hozir ${now.do} mg/L (< ${th.do.crit}). Aeratorni darhol yoqing va baliq holatini tekshiring.`
                   : `Сейчас ${now.do} мг/л (< ${th.do.crit}). Немедленно включите аэратор.`,
        action: { label: isUz ? 'Aerator boshqaruvi' : 'Управление', tab: 'holat' } });
    } else if (now.do != null && now.do < th.do.warn) {
      A.push({ severity: 'warn', icon: 'waves',
        title: isUz ? "Kislorod me'yordan past" : 'Кислород ниже нормы',
        text: isUz ? `Hozir ${now.do} mg/L. AUTO rejim yoqilganiga ishonch hosil qiling.`
                   : `Сейчас ${now.do} мг/л. Убедитесь, что включён режим AUTO.` });
    }
  } else if (doNote) {
    // DO sensori ishlamayapti — aniq sabab yoziladi
    A.push({ severity: 'info', icon: 'waves',
      title: isUz ? 'Kislorod (DO) sensori' : 'Датчик кислорода (DO)',
      text: doNote });
  }

  // ---- DO pasayish trendi (faqat DO present bo'lsa) ----
  if (doOk && tr.doSlope != null && tr.doSlope < -0.08 && (now.do == null || now.do >= th.do.crit)) {
    A.push({ severity: 'warn', icon: 'moon',
      title: isUz ? 'Kislorod pasaymoqda' : 'Кислород снижается',
      text: isUz
        ? `So'nggi soatlarda DO ~${Math.abs(tr.doSlope).toFixed(1)} mg/L/soat tezlikda tushmoqda. Bugun 22:00–05:00 oralig'ida aeratorni AUTO rejimida ishlatish tavsiya qilinadi.`
        : `DO падает ~${Math.abs(tr.doSlope).toFixed(1)} мг/л/час. Рекомендуется режим AUTO с 22:00 до 05:00.`,
      action: { label: isUz ? 'AUTO yoqish' : 'Включить AUTO', tab: 'holat' } });
  }

  // ---- 2) Harorat (faqat sensor PRESENT bo'lsa) ----
  if (tempOk) {
    if (now.t != null && now.t >= 33) {
      A.push({ severity: 'crit', icon: 'thermometer',
        title: isUz ? "Jazirama issiq — 'zamur' xavfi" : 'Экстремальная жара — риск замора',
        text: isUz
          ? `Suv ${now.t}°C. Aeratorlarni qo'shing, kislorod muhitiga katta ahamiyat bering — 'zamur' xavfi yuqori.`
          : `Вода ${now.t}°C. Включите аэраторы, следите за кислородом — высок риск замора.`,
        action: { label: isUz ? 'Aerator boshqaruvi' : 'Аэратор', tab: 'holat' } });
    } else if (now.t != null && now.t > th.temp.warnMax) {
      A.push({ severity: 'warn', icon: 'thermometer',
        title: isUz ? 'Harorat yuqori' : 'Высокая температура',
        text: isUz
          ? `Suv ${now.t}°C. Yem miqdorini ~8% kamaytirish tavsiya qilinadi — yem rejasi buni avtomatik hisobga oladi.`
          : `Вода ${now.t}°C. Рекомендуется снизить корм на ~8%.`,
        action: { label: isUz ? 'Yem rejasi' : 'План корма', tab: 'holat' } });
    } else if (now.t != null && now.t < th.temp.warnMin) {
      A.push({ severity: 'warn', icon: 'thermometer',
        title: isUz ? 'Harorat past' : 'Температура низкая',
        text: isUz
          ? `Suv ${now.t}°C. Baliqlarning hazm qilish tizimi sekinlashadi — yem miqdorini kamaytiring.`
          : `Вода ${now.t}°C. Пищеварение рыб замедлено — сократите корм.` });
    }
  } else if (tNote) {
    A.push({ severity: 'info', icon: 'thermometer',
      title: isUz ? 'Harorat sensori' : 'Датчик температуры',
      text: tNote });
  }

  // ---- 3) pH (faqat sensor PRESENT bo'lsa) ----
  if (phOk) {
    if (now.ph != null && (now.ph < 6.8 || now.ph > 8.8)) {
      A.push({ severity: 'warn', icon: 'activity',
        title: isUz ? "pH me'yordan chetda" : 'pH вне нормы',
        text: isUz
          ? `Hozir pH ${now.ph}. Tavsiya etilgan norma 7.5–8.5. Asta-sekin korrektsiya qiling.`
          : `pH ${now.ph}. Норма 7.5–8.5. Корректируйте постепенно.` });
    }
  } else if (phNote) {
    A.push({ severity: 'info', icon: 'activity',
      title: 'pH',
      text: phNote });
  }

  // ---- 4) Qo'lda rejim ----
  if (now.manual === 1 && (!now.man_remain || now.man_remain === 0)) {
    A.push({ severity: 'info', icon: 'power',
      title: isUz ? "Aerator qo'lda rejimda qolgan" : 'Аэратор в ручном режиме',
      text: isUz ? "Muddatsiz qo'lda yoqilgan. Elektr tejash uchun AUTO rejimga qaytaring."
                 : 'Включён вручную без таймера. Верните AUTO для экономии.',
      action: { label: 'AUTO', tab: 'holat' } });
  }

  // ---- 5) Ob-havo (faqat DO/harorat PRESENT bo'lsa ma'noli) ----
  if (ctx.weather && (doOk || tempOk)) {
    const w = ctx.weather;
    if (w.tomorrowTempMax >= 37) {
      A.push({ severity: 'warn', icon: 'sun',
        title: isUz ? "Ertaga jazirama — aerator rejimini kuchaytiring" : 'Завтра жара — усильте аэрацию',
        text: isUz
          ? `Ertaga ${w.tomorrowTempMax}°C. Issiq havoda kislorod tez pasayadi. Bugun kechki payt va ertaga tushdan keyin aeratorni uzoqroq ishlatish tavsiya qilinadi.`
          : `Завтра ${w.tomorrowTempMax}°C. Кислород падает быстрее в жару. Продлите аэрацию сегодня вечером.` });
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96].includes(w.code)) {
      A.push({ severity: 'info', icon: 'sun',
        title: isUz ? "Ertaga yog'ingarchilik" : 'Завтра осадки',
        text: isUz
          ? `Ertaga yomg'ir (${w.tomorrowLabel}, ${w.tomorrowTempMax}°C). Aeratorni AUTO rejimda qoldiring, yem miqdorini 20% kamaytiring.`
          : `Ожидаются осадки (${w.tomorrowLabel}, ${w.tomorrowTempMax}°C). Держите AUTO, снизьте корм на 20%.` });
    } else if (w.tomorrowTempMax <= 24) {
      A.push({ severity: 'info', icon: 'sun',
        title: isUz ? "Ertaga salqin ob-havo" : 'Завтра прохладно',
        text: isUz
          ? `Ertaga ${w.tomorrowTempMax}°C. Baliqlarning faolligi kamayadi — yem miqdorini moslashtiring.`
          : `Завтра ${w.tomorrowTempMax}°C. Активность рыб снизится — скорректируйте корм.` });
    }
  }

  // ---- 6) Yem ob-havo tavsiyasi (feedPlan dan) ----
  if (ctx.feedPlan && Array.isArray(ctx.feedPlan.notes) && ctx.feedPlan.notes.some((n) => n.id === 'weather')) {
    A.push({ severity: 'info', icon: 'feed',
      title: isUz ? "Ob-havo yomon — yem 50% kamaytirildi" : 'Плохая погода — корм снижен на 50%',
      text: isUz
        ? "Bulutli/shamolli kunlarda baliq ishtahasi pasayadi — bugungi yem rejasi avtomatik 50% ga qisqartirildi."
        : 'В пасмурные дни аппетит ниже — план корма снижен на 50%.',
      action: { label: isUz ? 'Yem rejasi' : 'План корма', tab: 'holat' } });
  }

  // ---- 7) Batareya ----
  if (ss.bat === SENSOR_STATE.PRESENT && now.battery != null && now.battery < th.battery.warn) {
    A.push({ severity: 'warn', icon: 'battery',
      title: isUz ? 'Batareya past' : 'Батарея разряжена',
      text: isUz ? `Qurilma batareyasi ${now.battery}%. Quvvat manbaini tekshiring.` : `Батарея ${now.battery}%.` });
  }

  // ---- 8) Qisman sensor muammolari (ba'zi sensorlar ishlamayapti) ----
  if (badNotes.length > 0 && hasSome) {
    A.push({ severity: 'info', icon: 'info',
      title: isUz ? "Ba'zi sensorlar ishlamayapti" : 'Некоторые датчики недоступны',
      text: badNotes.join('\n') });
  }

  // ---- 9) Hammasi barqaror ----
  if (!A.length) {
    const days = wk.days || 0;
    A.push({ severity: 'ok', icon: 'sun',
      title: isUz ? 'Hammasi barqaror' : 'Всё стабильно',
      text: isUz
        ? (days >= 5
          ? `Oxirgi ${days} kun davomida kislorod barqaror (o'rtacha ${wk.doAvg != null ? wk.doAvg.toFixed(1) : '—'} mg/L). Hozircha hech qanday choraga ehtiyoj yo'q.`
          : "Joriy ko'rsatkichlar me'yorda. Hozircha hech qanday choraga ehtiyoj yo'q.")
        : 'Показатели в норме, действий не требуется.' });
  }

  return A.map(normalizeAdvice);
}

export const ruleProvider = {
  id: 'rules',
  name: 'Lokal tahlil (qoidalar)',
  available: () => true,
  async generate(context, opts = {}) {
    return evaluateRules(context, opts.isUz !== false);
  },
};

export default ruleProvider;
