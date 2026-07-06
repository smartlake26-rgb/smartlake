// ============================================================
//  core/collections.js — Firestore sxemasi (yagona manba)
//  Barcha collection nomlari, rollar, statuslar shu yerda.
//  Servislar va rules testlari shu konstantalardan foydalanadi
//  (Development Standards §3.1, §1.4).
//  ADR-001: yagona baza — Firestore (RTDB yo'q).
// ============================================================

/** Ildiz kolleksiyalar. */
export const COLLECTIONS = Object.freeze({
  USERS: 'users',                 // users/{uid}
  DEVICES: 'devices',             // devices/{AQid}
  LAKES: 'lakes',                 // lakes/{lakeId}
  TELEMETRY: 'telemetry',         // telemetry/{AQid}  (latest) + /history
  COMMANDS: 'commands',           // commands/{autoId}
  REQUESTS: 'requests',           // requests/{autoId}
  ANNOUNCEMENTS: 'announcements', // announcements/{autoId}
  LOGS: 'logs',                   // logs/{autoId} (audit)
});

/** Subkolleksiyalar. */
export const SUBCOLLECTIONS = Object.freeze({
  HISTORY: 'history',             // telemetry/{AQid}/history/{autoId}
});

/** Foydalanuvchi rollari (users/{uid}.role). */
export const ROLES = Object.freeze({
  FARMER: 'farmer',               // standart — ko'l egasi
  OPERATOR: 'operator',           // umumiy admin
  REGION: 'region',               // hududiy admin
  SUPER: 'super',                 // super admin
});

/** Qurilma statusi (devices/{id}.status). */
export const DEVICE_STATUS = Object.freeze({
  UNASSIGNED: 'unassigned',
  ACTIVE: 'active',
  BLOCKED: 'blocked',
});

/** Buyruq statusi (commands/{id}.status). */
export const COMMAND_STATUS = Object.freeze({
  PENDING: 'pending',
  DONE: 'done',
});

/** So'rov statusi (requests/{id}.status). */
export const REQUEST_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

/** Hujjat yo'li quruvchilar (izchillik uchun). */
export const paths = Object.freeze({
  user: (uid) => `${COLLECTIONS.USERS}/${uid}`,
  device: (id) => `${COLLECTIONS.DEVICES}/${id}`,
  lake: (id) => `${COLLECTIONS.LAKES}/${id}`,
  telemetry: (id) => `${COLLECTIONS.TELEMETRY}/${id}`,
  history: (id) => `${COLLECTIONS.TELEMETRY}/${id}/${SUBCOLLECTIONS.HISTORY}`,
  command: (id) => `${COLLECTIONS.COMMANDS}/${id}`,
  request: (id) => `${COLLECTIONS.REQUESTS}/${id}`,
  announcement: (id) => `${COLLECTIONS.ANNOUNCEMENTS}/${id}`,
  log: (id) => `${COLLECTIONS.LOGS}/${id}`,
});

export default { COLLECTIONS, SUBCOLLECTIONS, ROLES, DEVICE_STATUS, COMMAND_STATUS, REQUEST_STATUS, paths };
