/**
 * Demo seed script - creates a complete demo tenant with:
 * - Tenant (Demo HVAC) + Owner user + Membership
 * - Business (Patriot HVAC) with timezone and business hours
 * - Location (Main Office in Reston, VA)
 * - Phone number (+17035550100) with AI_AFTER_HOURS routing
 * - Two agent profiles (daytime + after-hours)
 * - Three service areas (Reston, Sterling, Herndon)
 *
 * All operations are idempotent (upserts) and wrapped in a transaction.
 * Run via: pnpm --filter @frontdesk/db bootstrap:demo
 */

import {
  prisma,
  AgentChannel,
  BusinessVertical,
  MembershipRole,
  PhoneNumberProvider,
  PhoneRoutingMode,
  Weekday
} from './index';

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.upsert({
      where: { slug: 'demo-hvac' },
      update: { name: 'Demo HVAC' },
      create: { name: 'Demo HVAC', slug: 'demo-hvac' }
    });

    const user = await tx.user.upsert({
      where: { email: 'owner@demohvac.local' },
      update: { fullName: 'Demo Owner' },
      create: { email: 'owner@demohvac.local', fullName: 'Demo Owner' }
    });

    await tx.membership.upsert({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId: user.id }
      },
      update: { role: MembershipRole.OWNER },
      create: { tenantId: tenant.id, userId: user.id, role: MembershipRole.OWNER }
    });

    const existingBusiness = await tx.business.findFirst({
      where: { tenantId: tenant.id, slug: 'patriot-hvac' }
    });

    const business = existingBusiness
      ? await tx.business.update({
          where: { id: existingBusiness.id },
          data: {
            name: 'Patriot HVAC',
            vertical: BusinessVertical.HVAC,
            timezone: 'America/New_York',
            websiteUrl: 'https://example.com'
          }
        })
      : await tx.business.create({
          data: {
            tenantId: tenant.id,
            name: 'Patriot HVAC',
            slug: 'patriot-hvac',
            vertical: BusinessVertical.HVAC,
            timezone: 'America/New_York',
            websiteUrl: 'https://example.com'
          }
        });

    const existingLocation = await tx.location.findFirst({
      where: { businessId: business.id, name: 'Main Office' }
    });

    const location = existingLocation
      ? await tx.location.update({
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
      : await tx.location.create({
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

    const existingPhone = await tx.phoneNumber.findUnique({
      where: { e164: '+17035550100' }
    });

    const phoneNumber = existingPhone
      ? await tx.phoneNumber.update({
          where: { id: existingPhone.id },
          data: {
            tenantId: tenant.id,
            businessId: business.id,
            locationId: location.id,
            provider: PhoneNumberProvider.TWILIO,
            label: 'Main Line',
            externalSid: 'PN_DEMO_MAIN',
            isActive: true,
            routingMode: PhoneRoutingMode.AI_AFTER_HOURS
          }
        })
      : await tx.phoneNumber.create({
          data: {
            tenantId: tenant.id,
            businessId: business.id,
            locationId: location.id,
            provider: PhoneNumberProvider.TWILIO,
            e164: '+17035550100',
            label: 'Main Line',
            externalSid: 'PN_DEMO_MAIN',
            isActive: true,
            routingMode: PhoneRoutingMode.AI_AFTER_HOURS
          }
        });

    const existingMainAgent =
      (await tx.agentProfile.findFirst({
        where: {
          tenantId: tenant.id,
          businessId: business.id,
          name: 'Main Daytime Voice Agent'
        }
      })) ??
      (await tx.agentProfile.findFirst({
        where: {
          tenantId: tenant.id,
          businessId: business.id,
          name: 'Main Voice Agent'
        }
      }));

    const agentProfile = existingMainAgent
      ? await tx.agentProfile.update({
          where: { id: existingMainAgent.id },
          data: {
            name: 'Main Daytime Voice Agent',
            channel: AgentChannel.VOICE,
            language: 'en',
            voiceName: 'alloy',
            isActive: true,
            systemPrompt:
              'You are the main daytime AI front desk for Patriot HVAC & Plumbing. Capture lead details, identify urgency, and help book service calls efficiently.'
          }
        })
      : await tx.agentProfile.create({
          data: {
            tenantId: tenant.id,
            businessId: business.id,
            name: 'Main Daytime Voice Agent',
            channel: AgentChannel.VOICE,
            language: 'en',
            voiceName: 'alloy',
            isActive: true,
            systemPrompt:
              'You are the main daytime AI front desk for Patriot HVAC & Plumbing. Capture lead details, identify urgency, and help book service calls efficiently.'
          }
        });

    const existingAfterHoursAgent = await tx.agentProfile.findFirst({
      where: {
        tenantId: tenant.id,
        businessId: business.id,
        name: 'After Hours Voice Agent'
      }
    });

    const afterHoursAgent = existingAfterHoursAgent
      ? await tx.agentProfile.update({
          where: { id: existingAfterHoursAgent.id },
          data: {
            channel: AgentChannel.VOICE,
            language: 'en',
            voiceName: 'verse',
            isActive: true,
            systemPrompt:
              'You are the after-hours AI front desk for Patriot HVAC. Collect urgent service details, identify emergencies, and schedule callbacks.'
          }
        })
      : await tx.agentProfile.create({
          data: {
            tenantId: tenant.id,
            businessId: business.id,
            name: 'After Hours Voice Agent',
            channel: AgentChannel.VOICE,
            language: 'en',
            voiceName: 'verse',
            isActive: true,
            systemPrompt:
              'You are the after-hours AI front desk for Patriot HVAC. Collect urgent service details, identify emergencies, and schedule callbacks.'
          }
        });

    await tx.phoneNumber.update({
      where: { id: phoneNumber.id },
      data: {
        routingMode: PhoneRoutingMode.AI_AFTER_HOURS,
        primaryAgentProfileId: agentProfile.id,
        afterHoursAgentProfileId: afterHoursAgent.id,
        enableMissedCallTextBack: true
      }
    });

    const defaultHours = [
      { weekday: Weekday.MONDAY, openTime: '08:00', closeTime: '18:00', isClosed: false },
      { weekday: Weekday.TUESDAY, openTime: '08:00', closeTime: '18:00', isClosed: false },
      { weekday: Weekday.WEDNESDAY, openTime: '08:00', closeTime: '18:00', isClosed: false },
      { weekday: Weekday.THURSDAY, openTime: '08:00', closeTime: '18:00', isClosed: false },
      { weekday: Weekday.FRIDAY, openTime: '08:00', closeTime: '18:00', isClosed: false },
      { weekday: Weekday.SATURDAY, openTime: '09:00', closeTime: '14:00', isClosed: false },
      { weekday: Weekday.SUNDAY, openTime: null, closeTime: null, isClosed: true }
    ];

    for (const row of defaultHours) {
      await tx.businessHours.upsert({
        where: {
          businessId_weekday: { businessId: business.id, weekday: row.weekday }
        },
        update: {
          openTime: row.openTime,
          closeTime: row.closeTime,
          isClosed: row.isClosed
        },
        create: {
          businessId: business.id,
          weekday: row.weekday,
          openTime: row.openTime,
          closeTime: row.closeTime,
          isClosed: row.isClosed
        }
      });
    }

    const defaultServiceAreas = [
      { label: 'Reston Primary', city: 'Reston', state: 'VA', postalCode: '20190' },
      { label: 'Sterling Coverage', city: 'Sterling', state: 'VA', postalCode: '20164' },
      { label: 'Herndon Coverage', city: 'Herndon', state: 'VA', postalCode: '20170' }
    ];

    for (const area of defaultServiceAreas) {
      const existingArea = await tx.serviceArea.findFirst({
        where: { businessId: business.id, label: area.label }
      });

      if (existingArea) {
        await tx.serviceArea.update({
          where: { id: existingArea.id },
          data: area
        });
      } else {
        await tx.serviceArea.create({
          data: { businessId: business.id, ...area }
        });
      }
    }

    const hours = await tx.businessHours.findMany({
      where: { businessId: business.id },
      orderBy: { weekday: 'asc' },
      select: { id: true, weekday: true, openTime: true, closeTime: true, isClosed: true }
    });

    const serviceAreas = await tx.serviceArea.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, label: true, city: true, state: true, postalCode: true }
    });

    return {
      tenant: { id: tenant.id, slug: tenant.slug },
      user: { id: user.id, email: user.email },
      business: { id: business.id, slug: business.slug },
      location: { id: location.id, name: location.name },
      phoneNumber: {
        id: phoneNumber.id,
        e164: phoneNumber.e164,
        routingMode: PhoneRoutingMode.AI_AFTER_HOURS,
        primaryAgentProfileId: agentProfile.id,
        afterHoursAgentProfileId: afterHoursAgent.id,
        enableMissedCallTextBack: true
      },
      agentProfile: { id: agentProfile.id, name: agentProfile.name },
      afterHoursAgent: { id: afterHoursAgent.id, name: afterHoursAgent.name },
      businessHours: hours,
      serviceAreas
    };
  });

  process.stdout.write(JSON.stringify({ ok: true, ...result }, null, 2) + '\n');
}

main()
  .catch((error) => {
    process.stderr.write(JSON.stringify({ ok: false, error: String(error) }) + '\n');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
