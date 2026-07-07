// ============================================================
//  farmer/dataStore.js — Farmer prezentatsiya ma'lumot qatlami
//  Mavjud servislarni (lake/device/telemetry) BIRLASHTIRADI.
//  Bitta telemetriya listeneri butun ilova uchun (minimal Firestore read).
//  Backend'ga tegmaydi — faqat orkestratsiya. unsubscribe majburiy.
// ============================================================

import { lakeService } from '../features/lakes/index.js';
import { deviceService } from '../features/devices/index.js';
import { telemetryService } from '../features/telemetry/index.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';

const _state = { lakes: [], devices: [], telemetry: new Map(), loading: true };
const _subs = new Set();
let _unsub = null;
let _uid = null;

function emit() { const s = getState(); _subs.forEach((fn) => fn(s)); }

export function getState() {
  return { lakes: _state.lakes, devices: _state.devices, telemetry: _state.telemetry, loading: _state.loading };
}
export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }

/** Ko'llar + qurilmalarni qayta yuklash (mutatsiyalardan keyin). */
export async function refresh() {
  if (!_uid) return;
  try {
    const [lakes, devices] = await Promise.all([
      lakeService.listByOwner(_uid),
      deviceService.listByOwner(_uid),
    ]);
    _state.lakes = lakes;
    _state.devices = devices;
  } catch (e) { handleError(e, 'dataStore.refresh'); }
  _state.loading = false;
  emit();
}

/** Ishga tushirish: statik ma'lumot + realtime telemetriya listeneri. */
export async function start(uid) {
  _uid = uid;
  _state.loading = true;
  emit();
  await refresh();
  if (_unsub) _unsub();
  _unsub = telemetryService.watchByOwner(
    uid,
    ({ telemetry }) => { _state.telemetry = telemetry; emit(); },
    () => emit(),
  );
  logger.info('Farmer dataStore ishga tushdi');
}

export function stop() {
  if (_unsub) { _unsub(); _unsub = null; }
  _subs.clear();
  _state.lakes = []; _state.devices = []; _state.telemetry = new Map(); _state.loading = true;
  _uid = null;
}

export default { getState, subscribe, refresh, start, stop };
