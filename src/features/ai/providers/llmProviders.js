// ============================================================
//  features/ai/providers/llmProviders.js — TASHQI LLM ADAPTERLARI
//  (D-bosqich: ARXITEKTURA TAYYOR, API ULANMAGAN — topshiriq qoidasi).
//
//  Kelajakda ulash tartibi (har biri uchun bir xil):
//   1) API kalitni xavfsiz saqlang (env / backend proksi — kalitni
//      frontendga QO'YMANG, kichik Cloud Function proksi tavsiya).
//   2) available() -> konfiguratsiya mavjudligini qaytaring.
//   3) generate(context) -> buildPrompt(context) ni modelga yuborib,
//      javobni JSON Advice[] sifatida parse qiling (normalizeAdvice).
// ============================================================

import { normalizeAdvice } from './providerInterface.js';

/** LLM uchun yagona prompt-qurilish (barcha providerlar baham ko'radi). */
export function buildPrompt(context, locale = 'uz') {
  return [
    locale === 'uz'
      ? "Siz baliqchilik ko'li bo'yicha ekspertsiz. Quyidagi telemetriya asosida fermerga 1-4 ta qisqa, amaliy tavsiya bering."
      : 'Вы эксперт по рыбоводным озёрам. Дайте 1-4 кратких практичных совета по телеметрии.',
    'FAQAT JSON qaytaring: [{"severity":"crit|warn|info|ok","title":"...","text":"...","icon":"waves|thermometer|activity|power|battery|wifi|info"}]',
    'CONTEXT:',
    JSON.stringify(context),
  ].join('\n');
}

function stubProvider(id, name) {
  return {
    id, name,
    available: () => false,   // API kaliti/proksi sozlanmagan
    async generate() {
      throw new Error(`${name} hali ulanmagan — providers/llmProviders.js dagi yo'riqnomaga qarang`);
    },
    buildPrompt,              // ulashda tayyor
    parseResponse(text) {     // LLM javobini Advice[] ga aylantirish
      const clean = String(text).replace(/```json|```/g, '').trim();
      return JSON.parse(clean).map(normalizeAdvice);
    },
  };
}

export const geminiProvider = stubProvider('gemini', 'Google Gemini');
export const claudeProvider = stubProvider('claude', 'Anthropic Claude');
export const openaiProvider = stubProvider('openai', 'OpenAI GPT');
export const localLlmProvider = stubProvider('local', 'Mahalliy LLM (Ollama)');

export default { geminiProvider, claudeProvider, openaiProvider, localLlmProvider, buildPrompt };
