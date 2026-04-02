import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '@frontdesk/db';
import { resolveActiveWorkspace } from './active-workspace.js';

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

test('resolveActiveWorkspace uses the explicit tenant slug when configured', async (t) => {
  let capturedArgs: unknown;

  const restoreEnv = withEnv({
    FRONTDESK_ACTIVE_TENANT_SLUG: 'pilot-hvac',
    FRONTDESK_ACTIVE_BUSINESS_SLUG: undefined
  });
  const restorePrisma = stubTenantFindFirst((async (args?: unknown) => {
    capturedArgs = args;
    return {
      id: 'tenant_pilot',
      slug: 'pilot-hvac',
      name: 'Pilot HVAC',
      businesses: [
        {
          id: 'biz_alpha',
          slug: 'alpha',
          name: 'Alpha',
          vertical: 'hvac',
          timezone: 'America/New_York',
          locations: [],
          phoneNumbers: [],
          agentProfiles: []
        }
      ]
    };
  }) as unknown as TenantFindFirstStub);

  t.after(restoreEnv);
  t.after(restorePrisma);

  const tenant = await resolveActiveWorkspace();

  assert.deepEqual(capturedArgs, {
    where: {
      slug: 'pilot-hvac'
    },
    select: {
      id: true,
      slug: true,
      name: true,
      businesses: {
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          slug: true,
          name: true,
          vertical: true,
          timezone: true,
          locations: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              isPrimary: true
            }
          },
          phoneNumbers: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              e164: true,
              label: true,
              externalSid: true,
              isActive: true
            }
          },
          agentProfiles: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              name: true,
              channel: true,
              language: true,
              voiceName: true,
              isActive: true
            }
          }
        }
      }
    }
  });
  assert.equal(tenant?.slug, 'pilot-hvac');
});

test('resolveActiveWorkspace prioritizes the configured business when tenant and business slugs are set', async (t) => {
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

  const tenant = await resolveActiveWorkspace();

  assert.deepEqual(
    tenant?.businesses.map((business) => business.slug),
    ['south-branch', 'north-branch']
  );
});

test('resolveActiveWorkspace returns null when the configured tenant slug does not exist', async (t) => {
  let callCount = 0;

  const restoreEnv = withEnv({
    FRONTDESK_ACTIVE_TENANT_SLUG: 'missing-tenant',
    FRONTDESK_ACTIVE_BUSINESS_SLUG: 'ignored-business'
  });
  const restorePrisma = stubTenantFindFirst((async () => {
    callCount += 1;
    return null;
  }) as TenantFindFirstStub);

  t.after(restoreEnv);
  t.after(restorePrisma);

  const tenant = await resolveActiveWorkspace();

  assert.equal(callCount, 1);
  assert.equal(tenant, null);
});

test('resolveActiveWorkspace falls back to the first tenant by createdAt when no env is configured', async (t) => {
  let capturedArgs: unknown;

  const restoreEnv = withEnv({
    FRONTDESK_ACTIVE_TENANT_SLUG: undefined,
    FRONTDESK_ACTIVE_BUSINESS_SLUG: undefined
  });
  const restorePrisma = stubTenantFindFirst((async (args?: unknown) => {
    capturedArgs = args;
    return {
      id: 'tenant_first',
      slug: 'first-tenant',
      name: 'First Tenant',
      businesses: [
        {
          id: 'biz_first',
          slug: 'first-business',
          name: 'First Business',
          vertical: 'hvac',
          timezone: 'America/New_York',
          locations: [],
          phoneNumbers: [],
          agentProfiles: []
        }
      ]
    };
  }) as unknown as TenantFindFirstStub);

  t.after(restoreEnv);
  t.after(restorePrisma);

  const tenant = await resolveActiveWorkspace();

  assert.deepEqual(capturedArgs, {
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true,
      slug: true,
      name: true,
      businesses: {
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          slug: true,
          name: true,
          vertical: true,
          timezone: true,
          locations: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              name: true,
              city: true,
              state: true,
              isPrimary: true
            }
          },
          phoneNumbers: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              e164: true,
              label: true,
              externalSid: true,
              isActive: true
            }
          },
          agentProfiles: {
            orderBy: {
              createdAt: 'asc'
            },
            select: {
              id: true,
              name: true,
              channel: true,
              language: true,
              voiceName: true,
              isActive: true
            }
          }
        }
      }
    }
  });
  assert.equal(tenant?.slug, 'first-tenant');
  assert.equal(tenant?.businesses[0]?.slug, 'first-business');
});
