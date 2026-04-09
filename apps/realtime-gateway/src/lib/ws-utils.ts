import type { WsRaw, JsonRecord } from '../types.js';

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function rawToText(raw: WsRaw): string {
  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString('utf8');
  }
  if (Array.isArray(raw)) {
    return Buffer.concat(raw).toString('utf8');
  }
  return raw.toString('utf8');
}

export function rawSize(raw: WsRaw): number {
  if (raw instanceof ArrayBuffer) {
    return raw.byteLength;
  }
  if (Array.isArray(raw)) {
    return raw.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  return raw.length;
}

export function getString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

export function getNumberOrString(record: JsonRecord, key: string): number | string | null {
  const value = record[key];
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}
