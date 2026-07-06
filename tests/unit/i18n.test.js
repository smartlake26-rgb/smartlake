import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale } from '../../src/core/i18n/index.js';

describe('i18n', () => {
  beforeEach(() => setLocale('uz'));

  it('uz asosiy tilda tarjima qaytaradi', () => {
    setLocale('uz');
    expect(getLocale()).toBe('uz');
    expect(t('common.save')).toBe('Saqlash');
  });

  it('ru tiliga almashadi', () => {
    setLocale('ru');
    expect(t('common.save')).toBe('Сохранить');
  });

  it('{param} almashtiradi', () => {
    setLocale('uz');
    expect(t('auth.loggedInAs', { email: 'a@b.uz' })).toBe('Kirdingiz: a@b.uz');
  });

  it('yo\'q kalitni o\'zini qaytaradi (fallback)', () => {
    expect(t('bunday.kalit.yoq')).toBe('bunday.kalit.yoq');
  });

  it('qo\'llab-quvvatlanmaydigan tilni e\'tiborsiz qoldiradi', () => {
    setLocale('uz');
    setLocale('fr');
    expect(getLocale()).toBe('uz');
  });
});
