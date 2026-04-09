import { describe, it, expect } from 'vitest';
import { rawToText, rawSize, isRecord, getString, getNumberOrString } from '../ws-utils.js';

describe('rawToText', () => {
  it('converts Buffer to string', () => {
    expect(rawToText(Buffer.from('hello'))).toBe('hello');
  });

  it('converts ArrayBuffer to string', () => {
    const ab = new TextEncoder().encode('hello').buffer as ArrayBuffer;
    expect(rawToText(ab)).toBe('hello');
  });

  it('converts Buffer[] to string', () => {
    expect(rawToText([Buffer.from('hel'), Buffer.from('lo')])).toBe('hello');
  });
});

describe('rawSize', () => {
  it('returns Buffer length', () => {
    expect(rawSize(Buffer.from('hello'))).toBe(5);
  });

  it('returns ArrayBuffer byteLength', () => {
    const ab = new TextEncoder().encode('hello').buffer as ArrayBuffer;
    expect(rawSize(ab)).toBe(5);
  });

  it('returns total length for Buffer[]', () => {
    expect(rawSize([Buffer.from('hel'), Buffer.from('lo')])).toBe(5);
  });
});

describe('isRecord', () => {
  it('returns true for plain objects', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it('returns false for arrays', () => {
    expect(isRecord([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(isRecord(null)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isRecord('string')).toBe(false);
    expect(isRecord(42)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('getString', () => {
  it('returns string values', () => {
    expect(getString({ key: 'value' }, 'key')).toBe('value');
  });

  it('returns null for non-string values', () => {
    expect(getString({ key: 42 }, 'key')).toBeNull();
    expect(getString({ key: null }, 'key')).toBeNull();
  });

  it('returns null for missing keys', () => {
    expect(getString({}, 'key')).toBeNull();
  });
});

describe('getNumberOrString', () => {
  it('returns string values', () => {
    expect(getNumberOrString({ key: 'value' }, 'key')).toBe('value');
  });

  it('returns number values', () => {
    expect(getNumberOrString({ key: 42 }, 'key')).toBe(42);
  });

  it('returns null for other types', () => {
    expect(getNumberOrString({ key: true }, 'key')).toBeNull();
    expect(getNumberOrString({ key: null }, 'key')).toBeNull();
    expect(getNumberOrString({}, 'key')).toBeNull();
  });
});
