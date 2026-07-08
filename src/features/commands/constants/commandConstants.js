// ============================================================
//  features/commands/constants/commandConstants.js
//  Buyruq ta'riflari: har type -> label, ikon, guruh, payload.
// ============================================================

import { COMMAND_TYPES } from '../../../core/collections.js';

const T = COMMAND_TYPES;

/** Har buyruq turi uchun metama'lumot (UI + payload). */
export const COMMAND_DEFS = Object.freeze({
  [T.AERATOR_ON]:     { labelKey: 'cmd.aeratorOn',    icon: 'power',       group: 'aerator', payload: { aerator: 1 } },
  [T.AERATOR_OFF]:    { labelKey: 'cmd.aeratorOff',   icon: 'power',       group: 'aerator', payload: { aerator: 0 } },
  [T.AUTO_ON]:        { labelKey: 'cmd.autoOn',       icon: 'activity',    group: 'auto',    payload: { auto: 1 } },
  [T.AUTO_OFF]:       { labelKey: 'cmd.autoOff',      icon: 'activity',    group: 'auto',    payload: { auto: 0 } },
  [T.FEED_START]:     { labelKey: 'cmd.feedStart',    icon: 'droplet',     group: 'feed',    payload: { feed: 1 } },
  [T.FEED_STOP]:      { labelKey: 'cmd.feedStop',     icon: 'droplet',     group: 'feed',    payload: { feed: 0 } },
  [T.RESTART]:        { labelKey: 'cmd.restart',      icon: 'power',       group: 'system',  payload: {} },
  [T.SYNC_TIME]:      { labelKey: 'cmd.syncTime',     icon: 'settings',    group: 'system',  payload: {} },
  [T.REQUEST_STATUS]: { labelKey: 'cmd.reqStatus',    icon: 'info',        group: 'system',  payload: {} },
  [T.REQUEST_CONFIG]: { labelKey: 'cmd.reqConfig',    icon: 'settings',    group: 'system',  payload: {} },
});

/** Buyruq uchun kanonik payload (sync_time'ga vaqt qo'shiladi). */
export function buildPayload(type, now = Date.now()) {
  const def = COMMAND_DEFS[type];
  if (!def) return null;
  const base = { ...def.payload };
  if (type === COMMAND_TYPES.SYNC_TIME) base.ts = now;
  return base;
}

export const COMMAND_TTL_MS = 15 * 60 * 1000;   // pending 15 daq -> expired (CF/admin)

export default { COMMAND_DEFS, buildPayload, COMMAND_TTL_MS };
