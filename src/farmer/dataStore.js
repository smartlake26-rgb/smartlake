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

const _state = { lakes: [], archivedLakes: [], devices: [], telemetry: new Map(), loading: true };
const _subs = new Set();
let _unsub = null;
let _uid = null;

function emit() { const s = getState(); _subs.forEach((fn) => fn(s)); }

export function getState() {
  return { lakes: _state.lakes, archivedLakes: _state.archivedLakes, devices: _state.devices, telemetry: _state.telemetry, loading: _state.loading };
}
export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }

/** Ko'llar + qurilmalarni qayta yuklash (mutatsiyalardan keyin). */
export async function refresh() {
  if (!_uid) return;
  try {
    const [allLakes, devices] = await Promise.all([
      lakeService.listByOwner(_uid, { includeArchived: true }),
      deviceService.listByOwner(_uid),
    ]);
    _state.lakes = allLakes.filter((l) => l.status !== 'archived');
    _state.archivedLakes = allLakes.filter((l) => l.status === 'archived');
    _state.devices = devices;
    
    // Save to cache
    try {
      localStorage.setItem(`sl_cache_lakes_${_uid}`, JSON.stringify(allLakes));
      localStorage.setItem(`sl_cache_devices_${_uid}`, JSON.stringify(devices));
    } catch (err) {
      logger.warn('Error saving lakes/devices cache:', err);
    }
  } catch (e) { handleError(e, 'dataStore.refresh'); }
  _state.loading = false;
  emit();
}

/** Ishga tushirish: statik ma'lumot + realtime telemetriya listeneri. */
export async function start(uid) {
  _uid = uid;
  _state.loading = true;
  
  // Try loading from local storage cache first for instant load
  try {
    const cachedLakes = localStorage.getItem(`sl_cache_lakes_${uid}`);
    const cachedDevices = localStorage.getItem(`sl_cache_devices_${uid}`);
    const cachedTelemetry = localStorage.getItem(`sl_cache_telemetry_${uid}`);
    
    if (cachedLakes) {
      const allLakes = JSON.parse(cachedLakes);
      _state.lakes = allLakes.filter((l) => l.status !== 'archived');
      _state.archivedLakes = allLakes.filter((l) => l.status === 'archived');
    }
    if (cachedDevices) _state.devices = JSON.parse(cachedDevices);
    if (cachedTelemetry) {
      const parsed = JSON.parse(cachedTelemetry);
      _state.telemetry = new Map(Object.entries(parsed));
    }
    
    // If we have cached data, we can disable the primary loader so UI renders instantly!
    if (cachedLakes || cachedDevices) {
      _state.loading = false;
    }
  } catch (err) {
    logger.warn('Error loading cache on start:', err);
  }
  
  emit();
  await refresh();
  if (_unsub) _unsub();
  _unsub = telemetryService.watchByOwner(
    uid,
    ({ telemetry }) => { 
      _state.telemetry = telemetry; 
      
      // Save to cache
      try {
        const obj = Object.fromEntries(telemetry.entries());
        localStorage.setItem(`sl_cache_telemetry_${uid}`, JSON.stringify(obj));
      } catch (err) {
        logger.warn('Error saving telemetry cache:', err);
      }
      emit(); 
    },
    () => emit(),
  );
  logger.info('Farmer dataStore ishga tushdi');
}

export function stop() {
  if (_unsub) { _unsub(); _unsub = null; }
  _subs.clear();
  _state.lakes = []; _state.archivedLakes = []; _state.devices = []; _state.telemetry = new Map(); _state.loading = true;
  _uid = null;
}

export default { getState, subscribe, refresh, start, stop };
