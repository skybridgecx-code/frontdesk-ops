import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { NextRequest } from 'next/server';

import { config, proxy } from './proxy';

const ORIGINAL_ENV = {
  FRONTDESK_REQUIRE_BASIC_AUTH: process.env.FRONTDESK_REQUIRE_BASIC_AUTH,
  FRONTDESK_BASIC_AUTH_USER: process.env.FRONTDESK_BASIC_AUTH_USER,
  FRONTDESK_BASIC_AUTH_PASS: process.env.FRONTDESK_BASIC_AUTH_PASS,
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY
};

afterEach(() => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = ORIGINAL_ENV.FRONTDESK_REQUIRE_BASIC_AUTH;
  process.env.FRONTDESK_BASIC_AUTH_USER = ORIGINAL_ENV.FRONTDESK_BASIC_AUTH_USER;
  process.env.FRONTDESK_BASIC_AUTH_PASS = ORIGINAL_ENV.FRONTDESK_BASIC_AUTH_PASS;
  process.env.CLERK_SECRET_KEY = ORIGINAL_ENV.CLERK_SECRET_KEY;
});

function makeRequest(pathname: string, authorization?: string) {
  const headers = new Headers();
  if (authorization) {
    headers.set('authorization', authorization);
  }

  return {
    headers,
    url: `https://frontdesk.test${pathname}`
  } as unknown as NextRequest;
}

function setAuthEnv() {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  process.env.FRONTDESK_BASIC_AUTH_USER = 'operator';
  process.env.FRONTDESK_BASIC_AUTH_PASS = 's3cret';
  delete process.env.CLERK_SECRET_KEY;
}

test('proxy matcher covers all app routes for Clerk mode', () => {
  assert.deepEqual(config.matcher, ['/((?!_next|.*\..*).*)', '/(api|trpc)(.*)']);
});

test('proxy allows access when basic auth is disabled', async () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'false';
  const response = await proxy(makeRequest('/prospects'));

  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy does not require basic auth on unprotected routes in fallback mode', async () => {
  setAuthEnv();

  const response = await proxy(makeRequest('/'));

  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy blocks unauthenticated operator requests when basic auth is enabled', async () => {
  setAuthEnv();

  const response = await proxy(makeRequest('/prospects'));

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('www-authenticate'), 'Basic realm="SkybridgeCX"');
});

test('proxy allows authenticated operator requests when credentials match', async () => {
  setAuthEnv();

  const auth = Buffer.from('operator:s3cret').toString('base64');
  const response = await proxy(makeRequest('/calls', `Basic ${auth}`));

  assert.equal(response.headers.get('x-middleware-next'), '1');
});

test('proxy returns a server error when auth is required but credentials are missing', async () => {
  process.env.FRONTDESK_REQUIRE_BASIC_AUTH = 'true';
  delete process.env.FRONTDESK_BASIC_AUTH_USER;
  delete process.env.FRONTDESK_BASIC_AUTH_PASS;
  delete process.env.CLERK_SECRET_KEY;

  const response = await proxy(makeRequest('/calls'));

  assert.equal(response.status, 500);
});
