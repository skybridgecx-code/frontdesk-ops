import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getNumberOrString,
  getString,
  isRecord,
  rawSize,
  rawToText
} from './media-message.js';

test('rawToText handles buffer, array buffer, and buffer arrays', () => {
  assert.equal(rawToText(Buffer.from('hello')), 'hello');
  assert.equal(rawToText(Uint8Array.from([119, 111, 114, 108, 100]).buffer), 'world');
  assert.equal(rawToText([Buffer.from('foo'), Buffer.from('bar')]), 'foobar');
});

test('rawSize reports byte size across supported raw websocket payload types', () => {
  assert.equal(rawSize(Buffer.from('hello')), 5);
  assert.equal(rawSize(Uint8Array.from([1, 2, 3]).buffer), 3);
  assert.equal(rawSize([Buffer.from('ab'), Buffer.from('c')]), 3);
});

test('record access helpers stay narrow and deterministic', () => {
  const value: unknown = {
    name: 'frontdesk',
    count: 2,
    nested: {
      ok: true
    }
  };

  assert.equal(isRecord(value), true);
  assert.equal(getString(value as Record<string, unknown>, 'name'), 'frontdesk');
  assert.equal(getString(value as Record<string, unknown>, 'count'), null);
  assert.equal(getNumberOrString(value as Record<string, unknown>, 'count'), 2);
  assert.equal(getNumberOrString(value as Record<string, unknown>, 'nested'), null);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord(['not', 'a', 'record']), false);
});
