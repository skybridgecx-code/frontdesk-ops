import {
  prisma,
  CallDirection,
  CallReviewStatus,
  CallRouteKind,
  CallStatus,
  CallTriageStatus,
  ProspectPriority,
  ProspectSourceProvider,
  ProspectStatus
} from './index';

type DemoCallSeed = {
  key: string;
  callSid: string;
  twilioCallSid: string;
  callStatus: string;
  status: CallStatus;
  routeKind: CallRouteKind;
  callerName: string;
  callerPhone: string;
  callReason: string;
  leadName?: string;
  leadPhone?: string;
  leadIntent?: string;
  urgency?: string;
  serviceAddress?: string;
  summary: string;
  voicemailUrl?: string;
  voicemailDuration?: number;
  textBackSent?: boolean;
  startedAt: Date;
  answeredAt?: Date;
  completedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  triageStatus: CallTriageStatus;
  reviewStatus: CallReviewStatus;
};

type DemoProspectSeed = {
  prospectSid: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  state: string;
  serviceInterest: string;
  notes: string;
  status: ProspectStatus;
  priority: ProspectPriority;
};

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function demoCalls(now: Date): DemoCallSeed[] {
  const bookedStart = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const bookedAnswer = new Date(bookedStart.getTime() + 12_000);
  const bookedEnd = new Date(bookedAnswer.getTime() + 5 * 60_000 + 34_000);

  const drainStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const drainAnswer = new Date(drainStart.getTime() + 9_000);
  const drainEnd = new Date(drainAnswer.getTime() + 3 * 60_000 + 12_000);

  const missedStart = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const voicemailStart = new Date(now.getTime() - 19 * 60 * 60 * 1000);
  const voicemailEnd = new Date(voicemailStart.getTime() + 48_000);

  return [
    {
      key: 'booked_appointment',
      callSid: 'CA_SKYBRIDGE_DEMO_BOOKED_APPT',
      twilioCallSid: 'CA_SKYBRIDGE_DEMO_BOOKED_APPT',
      callStatus: 'completed',
      status: CallStatus.COMPLETED,
      routeKind: CallRouteKind.AI,
      callerName: 'Jordan Harper',
      callerPhone: '+15550101001',
      callReason: 'No cooling in upstairs zone before weekend guests.',
      leadName: 'Jordan Harper',
      leadPhone: '+15550101001',
      leadIntent: 'Book same-day HVAC diagnostic',
      urgency: 'HIGH',
      serviceAddress: '245 Demo Lane, Unit A',
      summary: 'Caller approved today 4:30 PM diagnostic visit and confirmed callback preference by text.',
      textBackSent: true,
      startedAt: bookedStart,
      answeredAt: bookedAnswer,
      completedAt: bookedEnd,
      endedAt: bookedEnd,
      durationSeconds: Math.round((bookedEnd.getTime() - bookedAnswer.getTime()) / 1000),
      triageStatus: CallTriageStatus.CONTACTED,
      reviewStatus: CallReviewStatus.REVIEWED
    },
    {
      key: 'missed_call',
      callSid: 'CA_SKYBRIDGE_DEMO_MISSED',
      twilioCallSid: 'CA_SKYBRIDGE_DEMO_MISSED',
      callStatus: 'no-answer',
      status: CallStatus.NO_ANSWER,
      routeKind: CallRouteKind.AI,
      callerName: 'Taylor Brooks',
      callerPhone: '+15550101002',
      callReason: 'Water heater pilot keeps shutting off.',
      summary: 'Call was missed and queued for rapid callback.',
      textBackSent: true,
      startedAt: missedStart,
      endedAt: new Date(missedStart.getTime() + 33_000),
      durationSeconds: 33,
      triageStatus: CallTriageStatus.OPEN,
      reviewStatus: CallReviewStatus.NEEDS_REVIEW
    },
    {
      key: 'voicemail',
      callSid: 'CA_SKYBRIDGE_DEMO_VOICEMAIL',
      twilioCallSid: 'CA_SKYBRIDGE_DEMO_VOICEMAIL',
      callStatus: 'voicemail',
      status: CallStatus.COMPLETED,
      routeKind: CallRouteKind.VOICEMAIL,
      callerName: 'Avery Lane',
      callerPhone: '+15550101003',
      callReason: 'Requesting quote for seasonal HVAC maintenance.',
      summary: 'Voicemail captured requesting Monday morning quote callback.',
      voicemailUrl: 'https://example.invalid/voicemail/skybridge-demo-01.mp3',
      voicemailDuration: 41,
      startedAt: voicemailStart,
      completedAt: voicemailEnd,
      endedAt: voicemailEnd,
      durationSeconds: 41,
      triageStatus: CallTriageStatus.OPEN,
      reviewStatus: CallReviewStatus.UNREVIEWED
    },
    {
      key: 'follow_up_call',
      callSid: 'CA_SKYBRIDGE_DEMO_FOLLOW_UP',
      twilioCallSid: 'CA_SKYBRIDGE_DEMO_FOLLOW_UP',
      callStatus: 'completed',
      status: CallStatus.COMPLETED,
      routeKind: CallRouteKind.AI,
      callerName: 'Casey Rivera',
      callerPhone: '+15550101004',
      callReason: 'Checking installation timeline for mini-split quote.',
      leadName: 'Casey Rivera',
      leadPhone: '+15550101004',
      leadIntent: 'Review quote and schedule install',
      urgency: 'MEDIUM',
      serviceAddress: '88 Sample Court',
      summary: 'Caller requested follow-up tomorrow at 10:00 AM after reviewing quote.',
      textBackSent: false,
      startedAt: drainStart,
      answeredAt: drainAnswer,
      completedAt: drainEnd,
      endedAt: drainEnd,
      durationSeconds: Math.round((drainEnd.getTime() - drainAnswer.getTime()) / 1000),
      triageStatus: CallTriageStatus.OPEN,
      reviewStatus: CallReviewStatus.REVIEWED
    }
  ];
}

function demoProspects(): DemoProspectSeed[] {
  return [
    {
      prospectSid: 'prospect_demo_hvac_northside',
      companyName: 'Northside Comfort Co.',
      contactName: 'Jordan Harper',
      contactPhone: '+15550101001',
      contactEmail: 'jordan.harper@northside-comfort.demo',
      city: 'Maple Heights',
      state: 'VA',
      serviceInterest: 'Emergency AC repair',
      notes: 'Wants same-day service and maintenance plan options.',
      status: ProspectStatus.QUALIFIED,
      priority: ProspectPriority.HIGH
    },
    {
      prospectSid: 'prospect_demo_plumbing_lakeside',
      companyName: 'Lakeside Home Services',
      contactName: 'Taylor Brooks',
      contactPhone: '+15550101002',
      contactEmail: 'taylor.brooks@lakeside-home.demo',
      city: 'Fairview',
      state: 'VA',
      serviceInterest: 'Water heater inspection',
      notes: 'Requested callback after 2 PM.',
      status: ProspectStatus.NEW,
      priority: ProspectPriority.MEDIUM
    },
    {
      prospectSid: 'prospect_demo_maintenance_willow',
      companyName: 'Willow Ridge Property Group',
      contactName: 'Avery Lane',
      contactPhone: '+15550101003',
      contactEmail: 'avery.lane@willow-ridge.demo',
      city: 'Oak Terrace',
      state: 'VA',
      serviceInterest: 'Quarterly preventative maintenance contract',
      notes: 'Multi-property opportunity, asks for service package comparison.',
      status: ProspectStatus.IN_PROGRESS,
      priority: ProspectPriority.HIGH
    }
  ];
}

async function main() {
  if (process.env.DEMO_SEED_CONFIRM !== 'skybridge-demo') {
    throw new Error(
      'Safety check failed. Re-run with DEMO_SEED_CONFIRM=skybridge-demo to seed demo data for the skybridge-demo tenant.'
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'skybridge-demo' },
    select: { id: true, slug: true, name: true }
  });

  if (!tenant) {
    throw new Error('Tenant slug "skybridge-demo" was not found. This seed script only updates that existing tenant.');
  }

  const business = await prisma.business.findFirst({
    where: { tenantId: tenant.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true }
  });

  if (!business) {
    throw new Error(`No business found for tenant "${tenant.slug}". Create a business before running this seed.`);
  }

  const phoneNumber = await prisma.phoneNumber.findFirst({
    where: { tenantId: tenant.id, businessId: business.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, e164: true, primaryAgentProfileId: true }
  });

  if (!phoneNumber) {
    throw new Error(`No active phone number found for tenant "${tenant.slug}". Connect a phone line before seeding calls.`);
  }

  const now = new Date();
  const seededCalls = demoCalls(now);
  const seededProspects = demoProspects();

  const result = await prisma.$transaction(async (tx) => {
    const callIds: string[] = [];

    for (const call of seededCalls) {
      const saved = await tx.call.upsert({
        where: { twilioCallSid: call.twilioCallSid },
        update: {
          tenantId: tenant.id,
          businessId: business.id,
          phoneNumberId: phoneNumber.id,
          agentProfileId: phoneNumber.primaryAgentProfileId ?? null,
          callSid: call.callSid,
          direction: CallDirection.INBOUND,
          status: call.status,
          callStatus: call.callStatus,
          routeKind: call.routeKind,
          fromE164: call.callerPhone,
          toE164: phoneNumber.e164,
          callerName: call.callerName,
          callerPhone: call.callerPhone,
          callReason: call.callReason,
          leadName: call.leadName ?? null,
          leadPhone: call.leadPhone ?? null,
          leadIntent: call.leadIntent ?? null,
          urgency: call.urgency ?? null,
          serviceAddress: call.serviceAddress ?? null,
          summary: call.summary,
          voicemailUrl: call.voicemailUrl ?? null,
          voicemailDuration: call.voicemailDuration ?? null,
          triageStatus: call.triageStatus,
          reviewStatus: call.reviewStatus,
          textBackSent: call.textBackSent ?? false,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt ?? null,
          completedAt: call.completedAt ?? null,
          endedAt: call.endedAt ?? null,
          durationSeconds: call.durationSeconds ?? null
        },
        create: {
          tenantId: tenant.id,
          businessId: business.id,
          phoneNumberId: phoneNumber.id,
          agentProfileId: phoneNumber.primaryAgentProfileId ?? null,
          callSid: call.callSid,
          twilioCallSid: call.twilioCallSid,
          direction: CallDirection.INBOUND,
          status: call.status,
          callStatus: call.callStatus,
          routeKind: call.routeKind,
          fromE164: call.callerPhone,
          toE164: phoneNumber.e164,
          callerName: call.callerName,
          callerPhone: call.callerPhone,
          callReason: call.callReason,
          leadName: call.leadName ?? null,
          leadPhone: call.leadPhone ?? null,
          leadIntent: call.leadIntent ?? null,
          urgency: call.urgency ?? null,
          serviceAddress: call.serviceAddress ?? null,
          summary: call.summary,
          voicemailUrl: call.voicemailUrl ?? null,
          voicemailDuration: call.voicemailDuration ?? null,
          triageStatus: call.triageStatus,
          reviewStatus: call.reviewStatus,
          textBackSent: call.textBackSent ?? false,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt ?? null,
          completedAt: call.completedAt ?? null,
          endedAt: call.endedAt ?? null,
          durationSeconds: call.durationSeconds ?? null
        },
        select: { id: true }
      });

      callIds.push(saved.id);
    }

    const prospectIds: string[] = [];

    for (const prospect of seededProspects) {
      const saved = await tx.prospect.upsert({
        where: { prospectSid: prospect.prospectSid },
        update: {
          tenantId: tenant.id,
          businessId: business.id,
          companyName: prospect.companyName,
          contactName: prospect.contactName,
          contactPhone: prospect.contactPhone,
          contactEmail: prospect.contactEmail,
          normalizedPhone: normalizePhone(prospect.contactPhone),
          normalizedEmail: prospect.contactEmail.toLowerCase(),
          city: prospect.city,
          state: prospect.state,
          serviceInterest: prospect.serviceInterest,
          notes: prospect.notes,
          sourceLabel: 'Demo Seed',
          sourceProvider: ProspectSourceProvider.MANUAL,
          status: prospect.status,
          priority: prospect.priority,
          nextActionAt: hoursAgo(6),
          lastSeenAt: now
        },
        create: {
          tenantId: tenant.id,
          businessId: business.id,
          prospectSid: prospect.prospectSid,
          companyName: prospect.companyName,
          contactName: prospect.contactName,
          contactPhone: prospect.contactPhone,
          contactEmail: prospect.contactEmail,
          normalizedPhone: normalizePhone(prospect.contactPhone),
          normalizedEmail: prospect.contactEmail.toLowerCase(),
          city: prospect.city,
          state: prospect.state,
          serviceInterest: prospect.serviceInterest,
          notes: prospect.notes,
          sourceLabel: 'Demo Seed',
          sourceProvider: ProspectSourceProvider.MANUAL,
          status: prospect.status,
          priority: prospect.priority,
          nextActionAt: hoursAgo(6),
          firstSeenAt: hoursAgo(72),
          lastSeenAt: now
        },
        select: { id: true }
      });

      prospectIds.push(saved.id);
    }

    return {
      tenantSlug: tenant.slug,
      businessName: business.name,
      seededCalls: callIds.length,
      seededProspects: prospectIds.length
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
