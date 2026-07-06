import { describe, it, expect } from 'vitest';
import { isAdmin, isSuper, hasRole, canAccess } from '../../src/features/auth/access.js';
import { ROLES, USER_STATUS } from '../../src/core/collections.js';
import { ADMIN_ROLES } from '../../src/features/auth/constants/authConstants.js';

describe('access (rol-asosidagi kirish)', () => {
  it('isAdmin', () => {
    expect(isAdmin(ROLES.OPERATOR)).toBe(true);
    expect(isAdmin(ROLES.SUPER)).toBe(true);
    expect(isAdmin(ROLES.REGION)).toBe(true);
    expect(isAdmin(ROLES.FARMER)).toBe(false);
  });

  it('isSuper', () => {
    expect(isSuper(ROLES.SUPER)).toBe(true);
    expect(isSuper(ROLES.OPERATOR)).toBe(false);
  });

  it('hasRole', () => {
    expect(hasRole(ROLES.OPERATOR, ADMIN_ROLES)).toBe(true);
    expect(hasRole(ROLES.FARMER, ADMIN_ROLES)).toBe(false);
  });

  it('canAccess: aktiv farmer har qanday rol talab qilmaydigan yo\'nalishga kiradi', () => {
    const farmer = { role: ROLES.FARMER, status: USER_STATUS.ACTIVE };
    expect(canAccess(farmer)).toBe(true);
    expect(canAccess(farmer, ADMIN_ROLES)).toBe(false);
  });

  it('canAccess: suspended kira olmaydi', () => {
    const suspended = { role: ROLES.FARMER, status: USER_STATUS.SUSPENDED };
    expect(canAccess(suspended)).toBe(false);
  });

  it('canAccess: aktiv operator admin yo\'nalishiga kiradi', () => {
    const op = { role: ROLES.OPERATOR, status: USER_STATUS.ACTIVE };
    expect(canAccess(op, ADMIN_ROLES)).toBe(true);
  });

  it('canAccess: null userDoc -> false', () => {
    expect(canAccess(null)).toBe(false);
    expect(canAccess(null, ADMIN_ROLES)).toBe(false);
  });
});
