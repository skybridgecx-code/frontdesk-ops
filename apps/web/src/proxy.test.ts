import test from 'node:test';
import assert from 'node:assert/strict';
import type { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

const originalEnv = {
  FRONTDESK_REQUIRE_BASIC_AUTH: process.env.FRONTDESK_REQUIRE_BASIC_AUTH,
  FRONTDESK_BASIC_AUTH_USER: process.env.FRONTDESK_BASIC_AUTH_USER,
  FRONTDESK_BASIC_AUTH_PASS: process.env.FRONTDESK_BASIC_AUTH_PASS
};

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function makeRequest(auth?: string) {
  return {
    headers: new Headers(auth ? { authorization: auth } : undefined)
  } as unknown as NextRequest;
}

test('proxy config protects operator surfaces only', () => {
  assert.deepEqual(config.matcher, ['/calls/:path*', '/prospects/:path*', '/workspace/:path*']);
});

test('proxy rejects unauthenticated requests when basic auth is required', () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  process.env.FRONTDESK_BASIC_AUTH_USER = 'ops';
  process.env.FRONTDESK_BASIC_AUTH_PASS = 'secret';

  const response = proxy(makeRequest());

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('WWW-Authenticate'), 'Basic realm="Frontdesk Ops"');

  restoreEnv();
});

test('proxy allows authenticated requests when credentials match', () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  process.env.FRONTDESK_BASIC_AUTH_USER = 'ops';
  process.env.FRONTDESK_BASIC_AUTH_PASS = 'secret';

  const auth = `Basic ${Buffer.from('ops:secret').toString('base64')}`;
  const response = proxy(makeRequest(auth));

  assert.equal(response.headers.get('x-middleware-next'), '1');

  restoreEnv();
});
