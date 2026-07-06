import { describe, it, expect } from 'vitest';
import { validateProfile, validatePhone, validateRegion } from '../../src/features/users/validators/userValidators.js';

describe('userValidators', () => {
  const ok = { ism: 'Ali', fam: 'Valiyev', vil: 'Samarqand', tum: 'Urgut', phone: '+998901234567' };

  it('to\'liq to\'g\'ri profil -> valid', () => {
    expect(validateProfile(ok).valid).toBe(true);
  });

  it('ism yo\'q -> xato', () => {
    const r = validateProfile({ ...ok, ism: '' });
    expect(r.valid).toBe(false);
    expect(r.messageKey).toBe('error.firstNameRequired');
  });

  it('familiya yo\'q -> xato', () => {
    expect(validateProfile({ ...ok, fam: '' }).messageKey).toBe('error.lastNameRequired');
  });

  it('viloyat noto\'g\'ri -> xato', () => {
    expect(validateRegion('YoqViloyat').valid).toBe(false);
    expect(validateRegion('Samarqand').valid).toBe(true);
  });

  it('telefon ixtiyoriy, lekin noto\'g\'ri format -> xato', () => {
    expect(validatePhone('').valid).toBe(true);            // ixtiyoriy
    expect(validatePhone('abc').valid).toBe(false);
    expect(validatePhone('+998 90 123 45 67').valid).toBe(true);
  });
});
