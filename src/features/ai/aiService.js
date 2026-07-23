// ============================================================
//  features/ai/aiService.js — AI ORKESTRATOR (D-bosqich)
//  1) buildContext: ko'lning BARCHA mavjud ma'lumotini yig'adi
//     (joriy telemetriya, 24h bufer, 7 kunlik arxiv, yem rejasi).
//  2) getAdvice: tanlangan provider orqali tavsiya oladi; LLM
//     ulanmagan bo'lsa avtomatik qoidalar dvigateliga tushadi.
//  Kesh: sessiyada ko'l boshiga bitta natija ("fermer har kirganda
//  yangi tavsiya" — ilova qayta ochilganda kesh bo'sh bo'ladi).
// ============================================================

import { historyService } from '../telemetry/services/historyService.js';
import { fetchArchive } from '../telemetry/services/archiveService.js';
import { computeFeedPlan } from '../telemetry/domain/feedEngine.js';
import { sensorState, lakeSensorState, SENSOR_STATE } from '../telemetry/domain/sensorState.js';
import { ruleProvider } from './providers/ruleProvider.js';
import { geminiProvider, claudeProvider, openaiProvider, localLlmProvider } from './providers/llmProviders.js';

export const PROVIDERS = [ruleProvider, geminiProvider, claudeProvider, openaiProvider, localLlmProvider];

const PREF_KEY = 'smartlake_ai_provider';
export function getSelectedProviderId() { return localStorage.getItem(PREF_KEY) || 'rules'; }
export function setSelectedProviderId(id) { localStorage.setItem(PREF_KEY, id); cache.clear(); }
function resolveProvider() {
  const p = PROVIDERS.find((x) => x.id === getSelectedProviderId());
  return p && p.available() ? p : ruleProvider;   // fallback: doim ishlaydigan qoidalar
}

/** Chiziqli regressiya qiyaligi: mg/L / soat. */
function slopePerHour(points) {
  const pts = points.filter((p) => typeof p.do === 'number');
  if (pts.length < 4) return null;
  const t0 = pts[0].ts;
  const xs = pts.map((p) => (p.ts - t0) / 3600e3), ys = pts.map((p) => p.do);
  const n = xs.length, sx = xs.reduce((a, b) => a + b, 0), sy = ys.reduce((a, b) => a + b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0), sxx = xs.reduce((a, x) => a + x * x, 0);
  const d = n * sxx - sx * sx;
  return d ? (n * sxy - sx * sy) / d : null;
}

export async function buildContext({ lake, devs, telemetry, th, meta, uid, weather = null }) {
  const firstId = devs.length ? devs[0].id : null;
  const now = firstId ? (telemetry.get(firstId) || {}) : {};

  // SENSOR HOLATLARI: AI tavsiyadan oldin har kanal tekshiriladi.
  // Ko'l darajasida (bir nechta qurilmada "present" bo'lsa — present).
  const allTels = devs.map((d) => telemetry.get(d.id) || null);
  const sensorStates = {
    do:   lakeSensorState(allTels, 'do'),
    t:    lakeSensorState(allTels, 't'),
    ph:   lakeSensorState(allTels, 'ph'),
    tds:  lakeSensorState(allTels, 'tds'),
    nh3:  lakeSensorState(allTels, 'nh3'),
    bat:  lakeSensorState(allTels, 'battery'),
  };
  // Faqat PRESENT holatlardagi qiymatlar AI'ga beriladi — qolganlar null
  const safeVal = (key, telKey) => sensorStates[key] === SENSOR_STATE.PRESENT
    ? (now[telKey] ?? null) : null;

  const pts24 = firstId ? await historyService.getHistory(firstId, '24h').catch(() => []) : [];
  const doVals = pts24.map((p) => p.do).filter((v) => typeof v === 'number');

  const weekFrom = Date.now() - 7 * 24 * 3600e3;
  const arch = uid ? await fetchArchive(uid, devs.map((d) => d.id), weekFrom, Date.now()).catch(() => []) : [];
  const wkDo = arch.map((x) => x.do).filter((v) => typeof v === 'number');
  const dayKeys = new Set(arch.map((x) => new Date(x.ts).toDateString()));

  const online = devs.filter((d) => {
    const tel = telemetry.get(d.id);
    return tel && Date.now() - tel.ts < 15 * 60e3;
  }).length;

  return {
    lake: { id: lake.id, name: lake.name, region: lake.region || null },
    thresholds: th,
    sensorStates,   // AI va UI sensor holatini tekshiradi
    now: {
      do:        safeVal('do', 'do'),         // ABSENT/FAULTY bo'lsa null
      t:         safeVal('t', 't'),
      ph:        safeVal('ph', 'ph'),
      rssi:      now.rssi ?? null,
      battery:   safeVal('bat', 'battery'),
      aer:       now.aer ?? null,
      manual:    now.manual ?? null,
      man_remain:now.man_remain ?? null,
      mode:      now.mode ?? null,
      ts:        now.ts ?? null,
    },
    trend24h: {
      points: pts24.length,
      doMin: doVals.length ? Math.min(...doVals) : null,
      doAvg: doVals.length ? doVals.reduce((a, b) => a + b, 0) / doVals.length : null,
      doMax: doVals.length ? Math.max(...doVals) : null,
      doSlope: slopePerHour(pts24),
    },
    week: {
      days: dayKeys.size,
      doMin: wkDo.length ? Math.min(...wkDo) : null,
      doAvg: wkDo.length ? wkDo.reduce((a, b) => a + b, 0) / wkDo.length : null,
    },
    weather: weather ? { code: weather.code ?? null, temp: weather.temp ?? null, label: weather.label ?? null } : null,
    feedPlan: meta ? computeFeedPlan({ fish: meta.fish || [], feed: meta.feed || {}, tempC: now.t, weather }) : null,
    devices: { total: devs.length, online },
  };
}

const cache = new Map();   // lakeId -> { at, advices, providerId }
export async function getAdvice(params, { force = false, isUz = true } = {}) {
  const key = params.lake.id;
  if (!force && cache.has(key)) return cache.get(key);
  const provider = resolveProvider();
  const context = await buildContext(params);
  const advices = await provider.generate(context, { isUz });
  const result = { at: Date.now(), advices, providerId: provider.id, providerName: provider.name, context };
  cache.set(key, result);
  return result;
}

export default { PROVIDERS, getAdvice, buildContext, getSelectedProviderId, setSelectedProviderId };
