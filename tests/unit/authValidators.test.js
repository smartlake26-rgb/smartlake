import { describe, it, expect } from 'vitest';
import {
  validateEmail, validatePassword, validateLoginForm,
} from '../../src/features/auth/validators/authValidators.js';

describe('authValidators', () => {
  it('email: bo\'sh -> xato', () => {
    expect(validateEmail('').valid).toBe(false);
    expect(validateEmail('').messageKey).toBe('error.emailRequired');
  });

  it('email: format', () => {
    expect(validateEmail('notanemail').valid).toBe(false);
    expect(validateEmail('user@smartlake.uz').valid).toBe(true);
  });

  it('parol: kamida 6 belgi', () => {
    expect(validatePassword('12345').valid).toBe(false);
    expect(validatePassword('12345').messageKey).toBe('error.passwordShort');
    expect(validatePassword('123456').valid).toBe(true);
  });

  it('login formasi birinchi xatoni qaytaradi', () => {
    const r = validateLoginForm({ email: 'bad', password: '123456' });
    expect(r.valid).toBe(false);
    expect(r.messageKey).toBe('error.emailInvalid');
  });

  it('to\'g\'ri forma -> valid', () => {
    expect(validateLoginForm({ email: 'a@b.uz', password: 'secret1' }).valid).toBe(true);
  });
});
