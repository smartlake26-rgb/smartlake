import { describe, it, expect } from 'vitest';
import {
  VILOYATLAR, PARAMS, DEVICE_ID_PATTERN, LIVE_FRESH_MS, LOCALES,
} from '../../src/core/config.js';

describe('config', () => {
  it('14 ta viloyat mavjud', () => {
    expect(VILOYATLAR).toHaveLength(14);
    expect(VILOYATLAR).toContain('Samarqand');
  });

  it('DO chegara mantig\'i to\'g\'ri', () => {
    expect(PARAMS.do.good(5)).toBe(true);
    expect(PARAMS.do.good(4.9)).toBe(false);
    expect(PARAMS.do.warn(3)).toBe(true);
    expect(PARAMS.do.warn(2.9)).toBe(false);
  });

  it('qurilma ID formati AQ + 8 hex (10 belgi)', () => {
    expect(DEVICE_ID_PATTERN.test('AQ3F9A21BC')).toBe(true);
    expect(DEVICE_ID_PATTERN.test('AQ7F8A2C')).toBe(false);   // eski 8-belgili XATO format
    expect(DEVICE_ID_PATTERN.test('aq3f9a21bc')).toBe(false); // kichik harf
  });

  it('freshness 15 daqiqa', () => {
    expect(LIVE_FRESH_MS).toBe(15 * 60 * 1000);
  });

  it('tillar uz va ru', () => {
    expect(LOCALES).toEqual(['uz', 'ru']);
  });
});
