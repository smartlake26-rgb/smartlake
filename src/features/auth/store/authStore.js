// ============================================================
//  features/auth/store/authStore.js — Sessiya holati (session store)
//  onAuthStateChanged'ni tinglaydi (auto-login: Firebase sessiyani
//  saqlaydi), users/{uid} hujjatini yuklaydi (rol/status/profil),
//  o'zgarishlar haqida obunachilarга xabar beradi.
//  Bu — "joriy foydalanuvchi + rol" ning yagona manbai.
// ============================================================

import { authService } from '../services/authService.js';
import { userService } from '../../users/index.js';
import { logger } from '../../../core/logger.js';
import { handleError } from '../../../core/errors.js';

const _state = { firebaseUser: null, userDoc: null, loading: true };
const _subs = new Set();

/** Tashqariga beriladigan tekis (flat) holat. */
export function getState() {
  const u = _state.firebaseUser;
  const d = _state.userDoc;
  return {
    firebaseUser: u,
    userDoc: d,
    uid: u ? u.uid : null,
    email: u ? u.email : null,
    emailVerified: u ? !!u.emailVerified : false,
    role: d ? d.role : null,
    status: d ? d.status : null,
    profile: d ? d.profile : null,
    locale: d ? d.locale : null,
    loading: _state.loading,
  };
}

function emit() {
  const s = getState();
  _subs.forEach((fn) => fn(s));
}

/** Holat o'zgarishiga obuna. Unsubscribe qaytaradi. */
export function subscribe(fn) {
  _subs.add(fn);
  return () => _subs.delete(fn);
}

async function loadUserDoc(uid) {
  try {
    _state.userDoc = await userService.getUser(uid);
  } catch (e) {
    _state.userDoc = null;
    handleError(e, 'authStore.loadUserDoc');
  }
}

let _started = false;

/** Store'ni ishga tushirish (bir marta). Auth holatini tinglay boshlaydi. */
export function initAuthStore() {
  if (_started) return;
  _started = true;
  authService.onChange(async (firebaseUser) => {
    _state.loading = true;
    _state.firebaseUser = firebaseUser;
    _state.userDoc = null;
    emit();
    if (firebaseUser) {
      await loadUserDoc(firebaseUser.uid);
    }
    _state.loading = false;
    logger.info('Auth holati:', firebaseUser ? `kirgan (${_state.userDoc ? _state.userDoc.role : 'hujjatsiz'})` : 'kirmagan');
    emit();
  });
}

/** Foydalanuvchi hujjatini + Firebase holatini qayta yuklash (register/profil/verify keyin). */
export async function reload() {
  const u = _state.firebaseUser;
  if (!u) return;
  try { await authService.reload(); } catch (e) { handleError(e, 'authStore.reload'); }
  _state.firebaseUser = authService.current();
  await loadUserDoc(u.uid);
  emit();
}

export default { getState, subscribe, initAuthStore, reload };
