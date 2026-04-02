import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { buildServer } from '../server.js';

type TenantFindFirstStub = typeof prisma.tenant.findFirst;

function stubTenantFindFirst(stub: TenantFindFirstStub) {
  const original = prisma.tenant.findFirst;
  prisma.tenant.findFirst = stub;

  return () => {
    prisma.tenant.findFirst = original;
  };
}

function withEnv(values: Record<string, string | undefined>) {
  const originalTenantSlug = process.env.FRONTDESK_ACTIVE_TENANT_SLUG;
  const originalBusinessSlug = process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG;

  if (values.FRONTDESK_ACTIVE_TENANT_SLUG === undefined) {
    delete process.env.FRONTDESK_ACTIVE_TENANT_SLUG;
  } else {
    process.env.FRONTDESK_ACTIVE_TENANT_SLUG = values.FRONTDESK_ACTIVE_TENANT_SLUG;
  }

  if (values.FRONTDESK_ACTIVE_BUSINESS_SLUG === undefined) {
    delete process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG;
  } else {
    process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG = values.FRONTDESK_ACTIVE_BUSINESS_SLUG;
  }

  return () => {
    if (originalTenantSlug === undefined) {
      delete process.env.FRONTDESK_ACTIVE_TENANT_SLUG;
    } else {
      process.env.FRONTDESK_ACTIVE_TENANT_SLUG = originalTenantSlug;
    }

    if (originalBusinessSlug === undefined) {
      delete process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG;
    } else {
      process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG = originalBusinessSlug;
    }
  };
}

test('GET /v1/bootstrap returns the expected shape with the configured active tenant and business first', async (t) => {
  const restoreEnv = withEnv({
    FRONTDESK_ACTIVE_TENANT_SLUG: 'pilot-hvac',
    FRONTDESK_ACTIVE_BUSINESS_SLUG: 'south-branch'
  });
  const restorePrisma = stubTenantFindFirst((async () => ({
    id: 'tenant_pilot',
    slug: 'pilot-hvac',
    name: 'Pilot HVAC',
    businesses: [
      {
        id: 'biz_north',
        slug: 'north-branch',
        name: 'North Branch',
        vertical: 'hvac',
        timezone: 'America/New_York',
        locations: [],
        phoneNumbers: [],
        agentProfiles: []
      },
      {
        id: 'biz_south',
        slug: 'south-branch',
        name: 'South Branch',
        vertical: 'hvac',
        timezone: 'America/New_York',
        locations: [],
        phoneNumbers: [],
        agentProfiles: []
      }
    ]
  })) as unknown as TenantFindFirstStub);

  t.after(restoreEnv);
  t.after(restorePrisma);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/bootstrap'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    tenant: {
      id: 'tenant_pilot',
      slug: 'pilot-hvac',
      name: 'Pilot HVAC',
      businesses: [
        {
          id: 'biz_south',
          slug: 'south-branch',
          name: 'South Branch',
          vertical: 'hvac',
          timezone: 'America/New_York',
          locations: [],
          phoneNumbers: [],
          agentProfiles: []
        },
        {
          id: 'biz_north',
          slug: 'north-branch',
          name: 'North Branch',
          vertical: 'hvac',
          timezone: 'America/New_York',
          locations: [],
          phoneNumbers: [],
          agentProfiles: []
        }
      ]
    }
  });
});

test('GET /v1/bootstrap returns a null tenant when the configured tenant slug is missing', async (t) => {
  const restoreEnv = withEnv({
    FRONTDESK_ACTIVE_TENANT_SLUG: 'missing-tenant',
    FRONTDESK_ACTIVE_BUSINESS_SLUG: undefined
  });
  const restorePrisma = stubTenantFindFirst((async () => null) as TenantFindFirstStub);

  t.after(restoreEnv);
  t.after(restorePrisma);

  const app = await buildServer();
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/v1/bootstrap'
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    tenant: null
  });
});
