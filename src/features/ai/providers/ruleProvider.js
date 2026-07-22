// ============================================================
//  features/ai/providers/ruleProvider.js — LOKAL QOIDALAR DVIGATELI
//  (D-bosqich). Hozir ISHLAYDIGAN provider: internet/APIsiz, ko'l
//  ma'lumotlarini tahlil qilib amaliy tavsiyalar beradi. Sof
//  funksiya — unit-testlar bilan qoplangan.
// ============================================================

import { normalizeAdvice } from './providerInterface.js';

/** ctx asosida tavsiyalar (sinxron mantiq, async interfeys uchun o'raladi). */
export function evaluateRules(ctx, isUz = true) {
  const A = [];
  const th = ctx.thresholds || { do: { crit: 3, warn: 5 }, temp: { warnMax: 30 }, battery: { warn: 30 } };
  const now = ctx.now || {};
  const tr = ctx.trend24h || {};
  const wk = ctx.week || {};

  // 1) KRITIK: DO hozir past
  if (now.do != null && now.do < th.do.crit) {
    A.push({ severity: 'crit', icon: 'waves',
      title: isUz ? 'Kislorod KRITIK darajada!' : 'Кислород КРИТИЧЕСКИ низкий!',
      text: isUz ? `Hozir ${now.do} mg/L (< ${th.do.crit}). Aeratorni darhol yoqing va baliq holatini tekshiring.`
                 : `Сейчас ${now.do} мг/л (< ${th.do.crit}). Немедленно включите аэратор.`,
      action: { label: isUz ? 'Aerator boshqaruvi' : 'Управление', tab: 'holat' } });
  } else if (now.do != null && now.do < th.do.warn) {
    A.push({ severity: 'warn', icon: 'waves',
      title: isUz ? 'Kislorod me\u02bcyordan past' : 'Кислород ниже нормы',
      text: isUz ? `Hozir ${now.do} mg/L. AUTO rejim yoqilganiga ishonch hosil qiling.`
                 : `Сейчас ${now.do} мг/л. Убедитесь, что включён режим AUTO.` });
  }

  // 2) DO pasayish trendi + tun — topshiriqdagi misol
  if (tr.doSlope != null && tr.doSlope < -0.08 && (now.do == null || now.do >= th.do.crit)) {
    A.push({ severity: 'warn', icon: 'moon',
      title: isUz ? 'Kislorod pasaymoqda' : 'Кислород снижается',
      text: isUz
        ? `So'nggi soatlarda DO ~${Math.abs(tr.doSlope).toFixed(1)} mg/L/soat tezlikda tushmoqda. Bugun 22:00–05:00 oralig'ida aeratorni AUTO rejimida ishlatish tavsiya qilinadi (tunda DO eng past bo'ladi).`
        : `DO падает ~${Math.abs(tr.doSlope).toFixed(1)} мг/л/час. Рекомендуется режим AUTO с 22:00 до 05:00.`,
      action: { label: isUz ? 'AUTO yoqish' : 'Включить AUTO', tab: 'holat' } });
  }

  // 3) Harorat yuqori -> yem kamaytirish — topshiriqdagi misol
  if (now.t != null && now.t > th.temp.warnMax) {
    A.push({ severity: 'warn', icon: 'thermometer',
      title: isUz ? 'Harorat yuqori' : 'Высокая температура',
      text: isUz
        ? `Suv ${now.t}°C. Yem miqdorini ~8% kamaytirish tavsiya qilinadi — issiqda baliq hazmi sekinlashadi (yem rejasi buni avtomatik hisobga oladi).`
        : `Вода ${now.t}°C. Рекомендуется снизить корм на ~8% — план корма учитывает это автоматически.`,
      action: { label: isUz ? 'Yem rejasi' : 'План корма', tab: 'holat' } });
  }

  // 4) Qo'lda rejim uzoq qolib ketgan
  if (now.manual === 1 && (!now.man_remain || now.man_remain === 0)) {
    A.push({ severity: 'info', icon: 'power',
      title: isUz ? "Aerator qo'lda rejimda qolgan" : 'Аэратор в ручном режиме',
      text: isUz ? "Muddatsiz qo'lda yoqilgan. Elektr tejash uchun AUTO rejimga qaytaring — kislorod baribir nazoratda bo'ladi."
                 : 'Включён вручную без таймера. Верните AUTO для экономии.',
      action: { label: 'AUTO', tab: 'holat' } });
  }

  // 5) Batareya / aloqa
  if (now.battery != null && now.battery < th.battery.warn) {
    A.push({ severity: 'warn', icon: 'battery',
      title: isUz ? 'Batareya past' : 'Батарея разряжена',
      text: isUz ? `Qurilma batareyasi ${now.battery}%. Quvvat manbaini tekshiring.` : `Батарея ${now.battery}%.` });
  }
  if (ctx.devices && ctx.devices.total > 0 && ctx.devices.online === 0) {
    A.push({ severity: 'crit', icon: 'wifi',
      title: isUz ? 'Barcha qurilmalar oflayn' : 'Все устройства офлайн',
      text: isUz ? "Ko'ldan ma'lumot kelmayapti — gateway va qurilma quvvatini, LoRa antennasini tekshiring."
                 : 'Нет данных — проверьте питание и антенну.' });
  }

  // 6) Hammasi barqaror — topshiriqdagi misol
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
