import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { config, proxy } from './proxy';

const ORIGINAL_ENV = {
  FRONTDESK_REQUIRE_BASIC_AUTH: process.env.FRONTDESK_REQUIRE_BASIC_AUTH,
  FRONTDESK_BASIC_AUTH_USER: process.env.FRONTDESK_BASIC_AUTH_USER,
  FRONTDESK_BASIC_AUTH_PASS: process.env.FRONTDESK_BASIC_AUTH_PASS
};

afterEach(() => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = ORIGINAL_ENV.FRONTDESK_REQUIRE_BASIC_AUTH;
  process.env.FRONTDESK_BASIC_AUTH_USER = ORIGINAL_ENV.FRONTDESK_BASIC_AUTH_USER;
  process.env.FRONTDESK_BASIC_AUTH_PASS = ORIGINAL_ENV.FRONTDESK_BASIC_AUTH_PASS;
});

function makeRequest(authorization?: string) {
  const headers = new Headers();
  if (authorization) {
    headers.set('authorization', authorization);
  }

  return {
    headers,
    url: 'https://frontdesk.test/prospects'
  } as never;
}

function setAuthEnv() {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  process.env.FRONTDESK_BASIC_AUTH_USER = 'operator';
  process.env.FRONTDESK_BASIC_AUTH_PASS = 's3cret';
}

test('proxy matcher only covers operator surfaces', () => {
  assert.deepEqual(config.matcher, [
    '/calls',
    '/calls/:path*',
    '/prospects',
    '/prospects/:path*'
  ]);
});

test('proxy allows access when basic auth is disabled', () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'false';
  const response = proxy(makeRequest());

  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy blocks unauthenticated operator requests when basic auth is enabled', () => {
  setAuthEnv();

  const response = proxy(makeRequest());

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Basic realm="Frontdesk Ops"');
});

test('proxy allows authenticated operator requests when credentials match', () => {
  setAuthEnv();

  const auth = Buffer.from('operator:s3cret').toString('base64');
  const response = proxy(makeRequest(`Basic ${auth}`));

  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy returns a server error when auth is required but credentials are missing', () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  delete process.env.FRONTDESK_BASIC_AUTH_USER;
  delete process.env.FRONTDESK_BASIC_AUTH_PASS;

  const response = proxy(makeRequest());

  assert.equal(response.status, 500);
});
