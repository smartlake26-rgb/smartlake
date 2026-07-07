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
  LAKE_CREATED: 'lake_created',
  LAKE_UPDATED: 'lake_updated',
  LAKE_ARCHIVED: 'lake_archived',
  LAKE_STATUS_CHANGED: 'lake_status_changed',
  DEVICE_ASSIGNED: 'device_assigned',
  DEVICE_UNASSIGNED: 'device_unassigned',
});

/** Audit obyekt turlari. */
export const AUDIT_TARGETS = Object.freeze({
  DEVICE: 'device',
  LAKE: 'lake',
  REQUEST: 'request',
  USER: 'user',
});

export default { AUDIT_ACTIONS, AUDIT_TARGETS };
