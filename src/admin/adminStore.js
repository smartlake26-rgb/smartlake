// ============================================================
//  admin/adminStore.js — Admin prezentatsiya ma'lumot qatlami
//  Faqat-o'qish admin so'rovlarini birlashtiradi + realtime telemetriya
//  va so'rovlar. Backend mantiqiga tegmaydi.
// ============================================================

import { userService } from '../features/users/index.js';
import { deviceService } from '../features/devices/index.js';
import { lakeService } from '../features/lakes/index.js';
import { telemetryService } from '../features/telemetry/index.js';
import { ownershipService } from '../features/ownership/index.js';
import { logger } from '../core/logger.js';
import { handleError } from '../core/errors.js';

const _state = { users: [], devices: [], lakes: [], telemetry: new Map(), requests: [], loading: true };
const _subs = new Set();
let _unsubTel = null;
let _unsubReq = null;
let _userDoc = null;

function emit() { const s = getState(); _subs.forEach((fn) => fn(s)); }
export function getState() { return { ..._state }; }
export function subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }

export async function refresh() {
  try {
    const [users, devices, lakes] = await Promise.all([
      userService.listAll(),
      deviceService.listAll(),
      lakeService.listAllAdmin(_userDoc || {}),
    ]);
    _state.users = users; _state.devices = devices; _state.lakes = lakes;
  } catch (e) { handleError(e, 'adminStore.refresh'); }
  _state.loading = false;
  emit();
}

export async function start(userDoc) {
  _userDoc = userDoc || {};
  _state.loading = true; emit();
  await refresh();
  if (_unsubTel) _unsubTel();
  _unsubTel = telemetryService.watchAll(({ telemetry }) => { _state.telemetry = telemetry; emit(); }, () => emit());
  if (_unsubReq) _unsubReq();
  _unsubReq = ownershipService.watchRequests(_userDoc, (reqs) => { _state.requests = reqs; emit(); });
  logger.info('Admin store ishga tushdi');
}

export function stop() {
  if (_unsubTel) { _unsubTel(); _unsubTel = null; }
  if (_unsubReq) { _unsubReq(); _unsubReq = null; }
  _subs.clear();
  Object.assign(_state, { users: [], devices: [], lakes: [], telemetry: new Map(), requests: [], loading: true });
  _userDoc = null;
}

export default { getState, subscribe, refresh, start, stop };
