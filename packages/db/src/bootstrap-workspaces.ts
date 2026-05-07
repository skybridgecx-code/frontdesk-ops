import { prisma } from './index';

const REQUIRED_CONFIRMATION = 'workspace-bootstrap';
const DEMO_SLUG = 'skybridge-demo';
const PRIVATE_SLUG = 'aatif-sales';

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function ensureTenantUserLink(input: {
  clerkUserId: string;
  tenantId: string;
  role: string;
}) {
  const existing = await prisma.tenantUser.findFirst({
    where: {
      clerkUserId: input.clerkUserId,
      tenantId: input.tenantId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    await prisma.tenantUser.create({
      data: {
        clerkUserId: input.clerkUserId,
        tenantId: input.tenantId,
        role: input.role
      }
    });
    return 'created';
  }

  await prisma.tenantUser.update({
    where: {
      id: existing.id
    },
    data: {
      role: input.role
    }
  });
  return 'updated';
}

async function main() {
  const confirmation = requiredEnv('WORKSPACE_BOOTSTRAP_CONFIRM');
  if (confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Safety check failed. Re-run with WORKSPACE_BOOTSTRAP_CONFIRM=${REQUIRED_CONFIRMATION}.`
    );
  }

  const clerkUserId = requiredEnv('CLERK_USER_ID');

  const demoTenant = await prisma.tenant.upsert({
    where: {
      slug: DEMO_SLUG
    },
    update: {
      name: 'Demo Workspace'
    },
    create: {
      slug: DEMO_SLUG,
      name: 'Demo Workspace',
      subscriptionStatus: 'trialing'
    },
    select: {
      id: true,
      slug: true,
      name: true
    }
  });

  const privateTenant = await prisma.tenant.upsert({
    where: {
      slug: PRIVATE_SLUG
    },
    update: {
      name: 'Private Sales Workspace'
    },
    create: {
      slug: PRIVATE_SLUG,
      name: 'Private Sales Workspace',
      subscriptionStatus: 'trialing'
    },
    select: {
      id: true,
      slug: true,
      name: true
    }
  });

  const demoLinkResult = await ensureTenantUserLink({
    clerkUserId,
    tenantId: demoTenant.id,
    role: 'owner'
  });

  const privateLinkResult = await ensureTenantUserLink({
    clerkUserId,
    tenantId: privateTenant.id,
    role: 'owner'
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceSlugs: {
          demoWorkspace: DEMO_SLUG,
          privateSalesWorkspace: PRIVATE_SLUG
        },
        clerkUserId,
        links: {
          [DEMO_SLUG]: demoLinkResult,
          [PRIVATE_SLUG]: privateLinkResult
        }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('[bootstrap-workspaces] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
