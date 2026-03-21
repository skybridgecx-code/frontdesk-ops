import {
  prisma,
  AgentChannel,
  BusinessVertical,
  MembershipRole,
  PhoneNumberProvider
} from './index';

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-hvac' },
    update: {
      name: 'Demo HVAC'
    },
    create: {
      name: 'Demo HVAC',
      slug: 'demo-hvac'
    }
  });

  const user = await prisma.user.upsert({
    where: { email: 'owner@demohvac.local' },
    update: {
      fullName: 'Demo Owner'
    },
    create: {
      email: 'owner@demohvac.local',
      fullName: 'Demo Owner'
    }
  });

  await prisma.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    update: {
      role: MembershipRole.OWNER
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      role: MembershipRole.OWNER
    }
  });

  const existingBusiness = await prisma.business.findFirst({
    where: {
      tenantId: tenant.id,
      slug: 'patriot-hvac'
    }
  });

  const business = existingBusiness
    ? await prisma.business.update({
        where: { id: existingBusiness.id },
        data: {
          name: 'Patriot HVAC',
          vertical: BusinessVertical.HVAC,
          timezone: 'America/New_York',
          websiteUrl: 'https://example.com'
        }
      })
    : await prisma.business.create({
        data: {
          tenantId: tenant.id,
          name: 'Patriot HVAC',
          slug: 'patriot-hvac',
          vertical: BusinessVertical.HVAC,
          timezone: 'America/New_York',
          websiteUrl: 'https://example.com'
        }
      });

  const existingLocation = await prisma.location.findFirst({
    where: {
      businessId: business.id,
      name: 'Main Office'
    }
  });

  const location = existingLocation
    ? await prisma.location.update({
        where: { id: existingLocation.id },
        data: {
          addressLine1: '123 Main St',
          city: 'Reston',
          state: 'VA',
          postalCode: '20190',
          countryCode: 'US',
          isPrimary: true
        }
      })
    : await prisma.location.create({
        data: {
          businessId: business.id,
          name: 'Main Office',
          addressLine1: '123 Main St',
          city: 'Reston',
          state: 'VA',
          postalCode: '20190',
          countryCode: 'US',
          isPrimary: true
        }
      });

  const existingPhone = await prisma.phoneNumber.findUnique({
    where: {
      e164: '+17035550100'
    }
  });

  const phoneNumber = existingPhone
    ? await prisma.phoneNumber.update({
        where: { id: existingPhone.id },
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          locationId: location.id,
          provider: PhoneNumberProvider.TWILIO,
          label: 'Main Line',
          externalSid: 'PN_DEMO_MAIN',
          isActive: true
        }
      })
    : await prisma.phoneNumber.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          locationId: location.id,
          provider: PhoneNumberProvider.TWILIO,
          e164: '+17035550100',
          label: 'Main Line',
          externalSid: 'PN_DEMO_MAIN',
          isActive: true
        }
      });

  const existingAgent = await prisma.agentProfile.findFirst({
    where: {
      tenantId: tenant.id,
      businessId: business.id,
      name: 'Main Voice Agent'
    }
  });

  const agentProfile = existingAgent
    ? await prisma.agentProfile.update({
        where: { id: existingAgent.id },
        data: {
          channel: AgentChannel.VOICE,
          language: 'en',
          voiceName: 'alloy',
          isActive: true,
          systemPrompt:
            'You are the polite, efficient AI front desk for Patriot HVAC. Capture lead details, identify urgency, and help book service.'
        }
      })
    : await prisma.agentProfile.create({
        data: {
          tenantId: tenant.id,
          businessId: business.id,
          name: 'Main Voice Agent',
          channel: AgentChannel.VOICE,
          language: 'en',
          voiceName: 'alloy',
          isActive: true,
          systemPrompt:
            'You are the polite, efficient AI front desk for Patriot HVAC. Capture lead details, identify urgency, and help book service.'
        }
      });

  console.log(
    JSON.stringify(
      {
        ok: true,
        tenant: { id: tenant.id, slug: tenant.slug },
        user: { id: user.id, email: user.email },
        business: { id: business.id, slug: business.slug },
        location: { id: location.id, name: location.name },
        phoneNumber: { id: phoneNumber.id, e164: phoneNumber.e164 },
        agentProfile: { id: agentProfile.id, name: agentProfile.name }
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
