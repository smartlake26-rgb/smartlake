// ============================================================
//  features/auth/access.js — Rol-asosidagi kirish (SOF mantiq)
//  DOM/Firebase'siz -> to'g'ridan-to'g'ri test qilinadi.
//  Rollar users/{uid}.role dan keladi (custom claim yo'q).
// ============================================================

import { ROLES, USER_STATUS } from '../../core/collections.js';
import { ADMIN_ROLES } from './constants/authConstants.js';

/** Rol admin (operator/region/super) mi? */
export function isAdmin(role) {
  return ADMIN_ROLES.includes(role);
}

/** Super admin mi? */
export function isSuper(role) {
  return role === ROLES.SUPER;
}

/** Rol ruxsat etilganlar ro'yxatidami? */
export function hasRole(role, allowed) {
  return Array.isArray(allowed) && allowed.includes(role);
}

/**
 * Foydalanuvchi (rol+status) berilgan yo'nalishga kira oladimi?
 * @param {{role, status}} userDoc
 * @param {string[]} [requiredRoles]  bo'sh/undefined = har qanday rol (faqat active)
 * @returns {boolean}
 */
export function canAccess(userDoc, requiredRoles) {
  if (!userDoc) return false;
  if (userDoc.status !== USER_STATUS.ACTIVE) return false;   // suspended -> yo'q
  if (!requiredRoles || requiredRoles.length === 0) return true;
  return hasRole(userDoc.role, requiredRoles);
}

export default { isAdmin, isSuper, hasRole, canAccess };
