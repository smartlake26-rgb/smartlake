// ============================================================
//  core/collections.js — Firestore sxemasi (yagona manba)
//  ADR-001: yagona baza — Firestore (RTDB yo'q).
// ============================================================

export const COLLECTIONS = Object.freeze({
  USERS: 'users',                 // users/{uid}
  DEVICES: 'devices',             // devices/{AQid}
  LAKES: 'lakes',                 // lakes/{lakeId}
  TELEMETRY: 'telemetry',         // telemetry/{AQid} (latest) + /history
  COMMANDS: 'commands',           // commands/{autoId}
  REQUESTS: 'requests',           // requests/{AQid}  (claim so'rovi — ID = deviceId)
  ANNOUNCEMENTS: 'announcements', // announcements/{autoId}
  AUDIT: 'audit',                 // audit/{autoId} (server yozadi — mijoz emas)
});

export const SUBCOLLECTIONS = Object.freeze({ HISTORY: 'history' });

/** Foydalanuvchi rollari (users/{uid}.role). */
export const ROLES = Object.freeze({
  FARMER: 'farmer', OPERATOR: 'operator', REGION: 'region', SUPER: 'super',
});

/** Foydalanuvchi statusi (users/{uid}.status). */
export const USER_STATUS = Object.freeze({ ACTIVE: 'active', SUSPENDED: 'suspended' });

/**
 * Device hayot sikli (devices/{id}.lifecycle) — FSM holati (SAQLANADI).
 * Presence (online/offline/pending) telemetriya ts'dan HISOBLANADI — bu bilan aralashmaydi.
 */
export const DEVICE_LIFECYCLE = Object.freeze({
  FACTORY: 'factory',
  PROVISIONED: 'provisioned',
  ASSIGNED: 'assigned',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  MAINTENANCE: 'maintenance',
  ERROR: 'error',
  RETIRED: 'retired',
});

/** Device presence (hisoblanadi — saqlanmaydi). */
export const DEVICE_PRESENCE = Object.freeze({ ONLINE: 'online', OFFLINE: 'offline', PENDING: 'pending' });

/** Ko'l statusi (lakes/{id}.status). Soft-delete: archived (fizik delete yo'q). */
export const LAKE_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
});

/** Buyruq statusi (FSM). */
export const COMMAND_STATUS = Object.freeze({
  PENDING: 'pending', SENT: 'sent', EXECUTED: 'executed', FAILED: 'failed', EXPIRED: 'expired',
});

/** Qo'llab-quvvatlanadigan buyruq turlari. */
export const COMMAND_TYPES = Object.freeze({
  AERATOR_ON: 'aerator_on',
  AERATOR_OFF: 'aerator_off',
  AUTO_ON: 'auto_on',
  AUTO_OFF: 'auto_off',
  FEED_START: 'feed_start',
  FEED_STOP: 'feed_stop',
  RESTART: 'restart',
  SYNC_TIME: 'sync_time',
  REQUEST_STATUS: 'request_status',
  REQUEST_CONFIG: 'request_config',
  // GW-BRIDGE: firmware haqiqatda qo'llab-quvvatlaydigan qo'shimcha buyruqlar
  MODE_DO: 'mode_do',         // CMD_MODE val=0 — kislorod (avto) rejimi
  MODE_TIME: 'mode_time',     // CMD_MODE val=1 — vaqt jadvali rejimi
  SET_MINDO: 'set_mindo',     // CMD_MINDO — minimal DO chegarasi (mg/L)
  SET_FARQ: 'set_farq',       // CMD_FARQ  — yetarli farq (gisterezis, mg/L)
  SET_KRITIK: 'set_kritik',   // CMD_KRITIK— kritik DO chegarasi (mg/L)
});

/** So'rov statusi. */
export const REQUEST_STATUS = Object.freeze({ PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected' });

export const paths = Object.freeze({
  user: (uid) => `${COLLECTIONS.USERS}/${uid}`,
  device: (id) => `${COLLECTIONS.DEVICES}/${id}`,
  lake: (id) => `${COLLECTIONS.LAKES}/${id}`,
  telemetry: (id) => `${COLLECTIONS.TELEMETRY}/${id}`,
  history: (id) => `${COLLECTIONS.TELEMETRY}/${id}/${SUBCOLLECTIONS.HISTORY}`,
  command: (id) => `${COLLECTIONS.COMMANDS}/${id}`,
  request: (id) => `${COLLECTIONS.REQUESTS}/${id}`,
  announcement: (id) => `${COLLECTIONS.ANNOUNCEMENTS}/${id}`,
  audit: (id) => `${COLLECTIONS.AUDIT}/${id}`,
});

export default {
  COLLECTIONS, SUBCOLLECTIONS, ROLES, USER_STATUS,
  DEVICE_LIFECYCLE, DEVICE_PRESENCE, LAKE_STATUS, COMMAND_STATUS, COMMAND_TYPES, REQUEST_STATUS, paths,
};
