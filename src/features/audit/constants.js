// ============================================================
//  features/audit/constants.js — Audit amal turlari
// ============================================================

export const AUDIT_ACTIONS = Object.freeze({
  DEVICE_CREATED: 'device_created',
  CLAIM_REQUESTED: 'claim_requested',
  CLAIM_APPROVED: 'claim_approved',
  CLAIM_REJECTED: 'claim_rejected',
  OWNERSHIP_CHANGED: 'ownership_changed',
  STATUS_CHANGED: 'status_changed',
});

/** Audit obyekt turlari. */
export const AUDIT_TARGETS = Object.freeze({
  DEVICE: 'device',
  LAKE: 'lake',
  REQUEST: 'request',
  USER: 'user',
});

export default { AUDIT_ACTIONS, AUDIT_TARGETS };
