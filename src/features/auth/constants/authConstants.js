// ============================================================
//  features/auth/constants/authConstants.js
// ============================================================

import { ROLES } from '../../../core/collections.js';

/** Auth/rejim ekranlari. */
export const AUTH_SCREENS = Object.freeze({
  LOGIN: 'login',
  REGISTER: 'register',
  FORGOT: 'forgot',
});

/** Ilova yo'nalishlari (router). */
export const ROUTES = Object.freeze({
  AUTH: 'auth',
  HOME: 'home',
  PROFILE: 'profile',
  SETTINGS: 'settings',
  CLAIM: 'claim',          // fermer: qurilma qo'shish
  REQUESTS: 'requests',    // admin: kutilayotgan so'rovlar
});

/** Admin hisoblangan rollar. */
export const ADMIN_ROLES = Object.freeze([ROLES.OPERATOR, ROLES.REGION, ROLES.SUPER]);

/**
 * Email tasdig'i majburiymi?
 * false = yumshoq (banner + qayta yuborish, bloklamaydi).
 * true  = majburiy (tasdiqlanmaguncha ilovaga kirmaydi).
 * Kelajakda o'zgartirish uchun yagona nuqta (workaround emas).
 */
export const REQUIRE_EMAIL_VERIFICATION = false;

export default { AUTH_SCREENS, ROUTES, ADMIN_ROLES, REQUIRE_EMAIL_VERIFICATION };
