// ============================================================
//  features/ai/providers/providerInterface.js — AI PROVIDER SHARTNOMASI
//  (D-bosqich). Har bir provider shu interfeysga bo'ysunadi — UI va
//  aiService provider almashganda O'ZGARMAYDI.
//
//  Provider = {
//    id: 'rules' | 'gemini' | 'claude' | 'openai' | 'local',
//    name: string,                       // UI'da ko'rinadigan nom
//    available(): boolean,               // hozir ishlashga tayyormi
//    generate(context): Promise<Advice[]>
//  }
//
//  Advice = {
//    severity: 'crit' | 'warn' | 'info' | 'ok',
//    icon: string,                       // shared/icons.js nomi
//    title: string,
//    text: string,
//    action?: { label: string, tab?: 'holat'|'tarix'|'sozlama' }
//  }
//
//  Context (aiService.buildContext yasaydi) — providerga beriladigan
//  BARCHA ma'lumot (LLM'ga prompt shu strukturadan quriladi):
//  { lake, thresholds, now:{do,t,ph,rssi,battery,aer,manual,mode,ts},
//    trend24h:{doMin,doAvg,doMax,doSlope,points},
//    week:{days,doMin,doAvg,warnHours},
//    feedPlan, weather, devices:{total,online} }
// ============================================================

/** Advice obyektini xavfsiz normallashtirish (LLM javoblari uchun ham). */
export function normalizeAdvice(a) {
  const SEV = ['crit', 'warn', 'info', 'ok'];
  return {
    severity: SEV.includes(a && a.severity) ? a.severity : 'info',
    icon: (a && a.icon) || 'info',
    title: String((a && a.title) || ''),
    text: String((a && a.text) || ''),
    action: a && a.action && a.action.label ? { label: String(a.action.label), tab: a.action.tab } : null,
  };
}

export default { normalizeAdvice };
