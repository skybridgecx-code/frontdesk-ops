import { prisma, AgentChannel } from './index';
import { demoCallFixtures } from './demo-call-fixtures';
import { demoProspectFixtures } from './demo-prospect-fixtures';

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'demo-hvac' },
    select: { id: true }
  });

  if (!tenant) {
    throw new Error('Demo tenant not found. Run `pnpm --filter @frontdesk/db bootstrap:demo` first.');
  }

  const business = await prisma.business.findFirst({
    where: {
      tenantId: tenant.id,
      slug: 'patriot-hvac'
    },
    select: { id: true }
  });

  if (!business) {
    throw new Error('Demo business not found. Run `pnpm --filter @frontdesk/db bootstrap:demo` first.');
  }

  const phoneNumber = await prisma.phoneNumber.findUnique({
    where: {
      e164: '+17035550100'
    },
    select: {
      id: true,
      e164: true
    }
  });

  if (!phoneNumber) {
    throw new Error('Demo phone number not found. Run `pnpm --filter @frontdesk/db bootstrap:demo` first.');
  }

  const agentProfile = await prisma.agentProfile.findFirst({
    where: {
      tenantId: tenant.id,
      businessId: business.id,
      channel: AgentChannel.VOICE,
      name: 'Main Daytime Voice Agent'
    },
    select: { id: true }
  });

  if (!agentProfile) {
    throw new Error('Demo agent profile not found. Run `pnpm --filter @frontdesk/db bootstrap:demo` first.');
  }

  for (const fixture of demoCallFixtures) {
    const existingCall = await prisma.call.findUnique({
      where: {
        twilioCallSid: fixture.twilioCallSid
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
      direction: 'INBOUND' as const,
      status: fixture.status,
      routeKind: fixture.routeKind,
      fromE164: fixture.fromE164,
      toE164: phoneNumber.e164,
      callerTranscript: fixture.callerTranscript,
      assistantTranscript: fixture.assistantTranscript,
      leadName: fixture.leadName,
      leadPhone: fixture.leadPhone,
      leadIntent: fixture.leadIntent,
      urgency: fixture.urgency,
      serviceAddress: fixture.serviceAddress,
      summary: fixture.summary,
      triageStatus: fixture.triageStatus,
      reviewStatus: fixture.reviewStatus,
      contactedAt: 'contactedAt' in fixture ? fixture.contactedAt : null,
      reviewedAt: 'reviewedAt' in fixture ? fixture.reviewedAt : null,
      archivedAt: null,
      startedAt: fixture.startedAt,
      answeredAt: fixture.answeredAt,
      endedAt: fixture.endedAt,
      durationSeconds: fixture.durationSeconds
    };

    if (existingCall) {
      await prisma.call.update({
        where: { id: existingCall.id },
        data
      });
    } else {
      await prisma.call.create({
        data: {
          twilioCallSid: fixture.twilioCallSid,
          twilioStreamSid: fixture.twilioStreamSid,
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

    const data = {
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
          data,
          select: { id: true }
        })
      : await prisma.prospect.create({
          data: {
            prospectSid: fixture.prospectSid,
            ...data
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        resetCalls: demoCallFixtures.map((fixture) => fixture.twilioCallSid),
        resetProspects: demoProspectFixtures.map((fixture) => fixture.prospectSid)
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
