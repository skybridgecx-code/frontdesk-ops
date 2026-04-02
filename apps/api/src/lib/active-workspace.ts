import { prisma } from '@frontdesk/db';

const bootstrapTenantSelect = {
  id: true,
  slug: true,
  name: true,
  businesses: {
    orderBy: {
      createdAt: 'asc' as const
    },
    select: {
      id: true,
      slug: true,
      name: true,
      vertical: true,
      timezone: true,
      locations: {
        orderBy: {
          createdAt: 'asc' as const
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
          createdAt: 'asc' as const
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
          createdAt: 'asc' as const
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
};

export type ActiveWorkspaceTenant = Awaited<ReturnType<typeof resolveActiveWorkspace>>;

function getConfiguredTenantSlug() {
  return process.env.FRONTDESK_ACTIVE_TENANT_SLUG?.trim() || null;
}

function getConfiguredBusinessSlug() {
  return process.env.FRONTDESK_ACTIVE_BUSINESS_SLUG?.trim() || null;
}

function prioritizeConfiguredBusiness<
  T extends {
    businesses: Array<{
      slug: string;
    }>;
  }
>(tenant: T, businessSlug: string | null) {
  if (!businessSlug) {
    return tenant;
  }

  const matchingBusiness = tenant.businesses.find((business) => business.slug === businessSlug);

  if (!matchingBusiness) {
    return tenant;
  }

  return {
    ...tenant,
    businesses: [
      matchingBusiness,
      ...tenant.businesses.filter((business) => business.slug !== businessSlug)
    ]
  };
}

export async function resolveActiveWorkspace() {
  const tenantSlug = getConfiguredTenantSlug();
  const businessSlug = getConfiguredBusinessSlug();

  if (tenantSlug) {
    const tenant = await prisma.tenant.findFirst({
      where: {
        slug: tenantSlug
      },
      select: bootstrapTenantSelect
    });

    if (!tenant) {
      return null;
    }

    return prioritizeConfiguredBusiness(tenant, businessSlug);
  }

  const tenant = await prisma.tenant.findFirst({
    orderBy: {
      createdAt: 'asc'
    },
    select: bootstrapTenantSelect
  });

  if (!tenant) {
    return null;
  }

  return tenant;
}
