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

/** Buyruq statusi. */
export const COMMAND_STATUS = Object.freeze({ PENDING: 'pending', DONE: 'done' });

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
  DEVICE_LIFECYCLE, DEVICE_PRESENCE, COMMAND_STATUS, REQUEST_STATUS, paths,
};
