// ============================================================
//  features/auth/validators/authValidators.js
//  Sof validatsiya funksiyalari (DOM/Firebase'siz) -> test-oson.
//  Har biri { valid, messageKey } qaytaradi; UI messageKey ni
//  t() orqali matnga aylantiradi.
// ============================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  const v = String(email || '').trim();
  if (!v) return { valid: false, messageKey: 'error.emailRequired' };
  if (!EMAIL_RE.test(v)) return { valid: false, messageKey: 'error.emailInvalid' };
  return { valid: true };
}

export function validatePassword(password) {
  const v = String(password || '');
  if (!v) return { valid: false, messageKey: 'error.passwordRequired' };
  if (v.length < 6) return { valid: false, messageKey: 'error.passwordShort' };
  return { valid: true };
}

/** Login formasi: email + parol. Birinchi xatoni qaytaradi. */
export function validateLoginForm({ email, password }) {
  const e = validateEmail(email);
  if (!e.valid) return e;
  const p = validatePassword(password);
  if (!p.valid) return p;
  return { valid: true };
}

/** Ro'yxatdan o'tish (Sprint-1: email + parol). Boy profil Sprint-3'da. */
export function validateRegisterForm({ email, password }) {
  return validateLoginForm({ email, password });
}

export default { validateEmail, validatePassword, validateLoginForm, validateRegisterForm };
