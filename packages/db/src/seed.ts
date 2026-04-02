import {
  prisma,
  CallDirection,
  CallReviewStatus,
  CallRouteKind,
  CallStatus,
  CallTriageStatus,
  AgentChannel,
  BusinessVertical,
  MembershipRole,
  PhoneNumberProvider,
  PhoneRoutingMode,
  Weekday
} from './index';
import { demoCallFixtures } from './demo-call-fixtures';
import { demoProspectFixtures } from './demo-prospect-fixtures';

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
          isActive: true,
          routingMode: PhoneRoutingMode.AI_AFTER_HOURS
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
          isActive: true,
          routingMode: PhoneRoutingMode.AI_AFTER_HOURS
        }
      });

  const existingMainAgent =
    (await prisma.agentProfile.findFirst({
      where: {
        tenantId: tenant.id,
        businessId: business.id,
        name: 'Main Daytime Voice Agent'
      }
    })) ??
    (await prisma.agentProfile.findFirst({
      where: {
        tenantId: tenant.id,
        businessId: business.id,
        name: 'Main Voice Agent'
      }
    }));

  const agentProfile = existingMainAgent
    ? await prisma.agentProfile.update({
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
    : await prisma.agentProfile.create({
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

  const existingAfterHoursAgent = await prisma.agentProfile.findFirst({
    where: {
      tenantId: tenant.id,
      businessId: business.id,
      name: 'After Hours Voice Agent'
    }
  });

  const afterHoursAgent = existingAfterHoursAgent
    ? await prisma.agentProfile.update({
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
    : await prisma.agentProfile.create({
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

  await prisma.phoneNumber.update({
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
    await prisma.businessHours.upsert({
      where: {
        businessId_weekday: {
          businessId: business.id,
          weekday: row.weekday
        }
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
    const existingArea = await prisma.serviceArea.findFirst({
      where: {
        businessId: business.id,
        label: area.label
      }
    });

    if (existingArea) {
      await prisma.serviceArea.update({
        where: { id: existingArea.id },
        data: area
      });
    } else {
      await prisma.serviceArea.create({
        data: {
          businessId: business.id,
          ...area
        }
      });
    }
  }

  const demoCalls = demoCallFixtures.map((demoCall) => ({
    ...demoCall,
    toE164: phoneNumber.e164
  }));

  for (const demoCall of demoCalls) {
    const existingCall = await prisma.call.findUnique({
      where: {
        twilioCallSid: demoCall.twilioCallSid
      },
      select: {
        id: true
      }
    });

    const data = {
      tenantId: tenant.id,
      businessId: business.id,
      phoneNumberId: phoneNumber.id,
      agentProfileId: agentProfile.id,
      direction: CallDirection.INBOUND,
      status: demoCall.status,
      routeKind: demoCall.routeKind,
      fromE164: demoCall.fromE164,
      toE164: demoCall.toE164,
      callerTranscript: demoCall.callerTranscript,
      assistantTranscript: demoCall.assistantTranscript,
      leadName: demoCall.leadName,
      leadPhone: demoCall.leadPhone,
      leadIntent: demoCall.leadIntent,
      urgency: demoCall.urgency,
      serviceAddress: demoCall.serviceAddress,
      summary: demoCall.summary,
      triageStatus: demoCall.triageStatus,
      reviewStatus: demoCall.reviewStatus,
      contactedAt: 'contactedAt' in demoCall ? demoCall.contactedAt : null,
      reviewedAt: 'reviewedAt' in demoCall ? demoCall.reviewedAt : null,
      startedAt: demoCall.startedAt,
      answeredAt: demoCall.answeredAt,
      endedAt: demoCall.endedAt,
      durationSeconds: demoCall.durationSeconds
    };

    if (existingCall) {
      await prisma.call.update({
        where: { id: existingCall.id },
        data
      });
    } else {
      await prisma.call.create({
        data: {
          twilioCallSid: demoCall.twilioCallSid,
          twilioStreamSid: demoCall.twilioStreamSid,
          ...data
        }
      });
    }
  }

  for (const fixture of demoProspectFixtures) {
    const existingProspect = await prisma.prospect.findUnique({
      where: {
        prospectSid: fixture.prospectSid
      },
      select: {
        id: true
      }
    });

    const prospectData = {
      tenantId: tenant.id,
      businessId: business.id,
      companyName: fixture.companyName,
      contactName: fixture.contactName,
      contactPhone: fixture.contactPhone,
      contactEmail: fixture.contactEmail,
      city: fixture.city,
      state: fixture.state,
      sourceLabel: fixture.sourceLabel,
      serviceInterest: fixture.serviceInterest,
      notes: fixture.notes,
      status: fixture.status,
      priority: fixture.priority,
      nextActionAt: fixture.nextActionAt,
      lastAttemptAt: fixture.lastAttemptAt,
      respondedAt: fixture.respondedAt,
      archivedAt: fixture.archivedAt
    };

    const prospect = existingProspect
      ? await prisma.prospect.update({
          where: { id: existingProspect.id },
          data: prospectData,
          select: { id: true }
        })
      : await prisma.prospect.create({
          data: {
            prospectSid: fixture.prospectSid,
            ...prospectData
          },
          select: { id: true }
        });

    await prisma.prospectAttempt.deleteMany({
      where: { prospectId: prospect.id }
    });

    if (fixture.attempts.length > 0) {
      await prisma.prospectAttempt.createMany({
        data: fixture.attempts.map((attempt) => ({
          prospectId: prospect.id,
          channel: attempt.channel,
          outcome: attempt.outcome,
          note: attempt.note,
          attemptedAt: attempt.attemptedAt
        }))
      });
    }
  }

  const hours = await prisma.businessHours.findMany({
    where: { businessId: business.id },
    orderBy: { weekday: 'asc' },
    select: {
      id: true,
      weekday: true,
      openTime: true,
      closeTime: true,
      isClosed: true
    }
  });

  const serviceAreas = await prisma.serviceArea.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      label: true,
      city: true,
      state: true,
      postalCode: true
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
        demoCallsSeeded: demoCalls.map((call) => ({
          twilioCallSid: call.twilioCallSid,
          status: call.status,
          triageStatus: call.triageStatus,
          reviewStatus: call.reviewStatus,
          hasCallerTranscript: Boolean(call.callerTranscript),
          hasAssistantTranscript: Boolean(call.assistantTranscript),
          hasSummary: Boolean(call.summary)
        })),
        demoProspectsSeeded: demoProspectFixtures.map((prospect) => ({
          prospectSid: prospect.prospectSid,
          status: prospect.status,
          priority: prospect.priority,
          attempts: prospect.attempts.length
        })),
        businessHours: hours,
        serviceAreas
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
