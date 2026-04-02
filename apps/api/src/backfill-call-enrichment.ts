import {
  CallReviewStatus,
  CallStatus,
  CallTriageStatus,
  prisma,
  type Prisma
} from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';

type Args = {
  dryRun: boolean;
  limit: number;
  callSid: string | null;
};

type CandidateCall = {
  id: string;
  twilioCallSid: string;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  summary: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  reviewStatus: CallReviewStatus;
  triageStatus: CallTriageStatus;
  archivedAt: Date | null;
  status: CallStatus;
};

type BackfillUpdate = {
  leadName?: string;
  leadPhone?: string;
  leadIntent?: string;
  urgency?: string;
  serviceAddress?: string;
  summary?: string;
};

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let limit = 25;
  let callSid: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--') {
      continue;
    }

    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (arg === '--limit') {
      const next = argv[index + 1];
      const parsed = Number(next);

      if (!next || !Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--limit requires a positive integer');
      }

      limit = parsed;
      index += 1;
      continue;
    }

    if (arg === '--call-sid') {
      const next = argv[index + 1];

      if (!next) {
        throw new Error('--call-sid requires a value');
      }

      callSid = next;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    dryRun,
    limit,
    callSid
  };
}

function buildMissingEnrichmentWhere(): Prisma.CallWhereInput {
  return {
    OR: [
      { summary: null },
      { leadIntent: null },
      { urgency: null },
      { serviceAddress: null },
      {
        AND: [
          { leadName: null },
          { leadPhone: null },
          { leadIntent: null },
          { urgency: null },
          { serviceAddress: null },
          { summary: null }
        ]
      }
    ]
  };
}

function buildEligibleWhere(callSid: string | null): Prisma.CallWhereInput {
  return {
    status: CallStatus.COMPLETED,
    triageStatus: {
      not: CallTriageStatus.ARCHIVED
    },
    archivedAt: null,
    reviewStatus: {
      not: CallReviewStatus.REVIEWED
    },
    OR: [{ callerTranscript: { not: null } }, { assistantTranscript: { not: null } }],
    AND: [buildMissingEnrichmentWhere(), callSid ? { twilioCallSid: callSid } : {}]
  };
}

function buildNoTranscriptWhere(callSid: string | null): Prisma.CallWhereInput {
  return {
    status: CallStatus.COMPLETED,
    triageStatus: {
      not: CallTriageStatus.ARCHIVED
    },
    archivedAt: null,
    reviewStatus: {
      not: CallReviewStatus.REVIEWED
    },
    callerTranscript: null,
    assistantTranscript: null,
    AND: [buildMissingEnrichmentWhere(), callSid ? { twilioCallSid: callSid } : {}]
  };
}

async function loadCandidates(args: Args) {
  return prisma.call.findMany({
    where: buildEligibleWhere(args.callSid),
    orderBy: [{ startedAt: 'desc' }],
    take: args.limit,
    select: {
      id: true,
      twilioCallSid: true,
      callerTranscript: true,
      assistantTranscript: true,
      summary: true,
      leadName: true,
      leadPhone: true,
      leadIntent: true,
      urgency: true,
      serviceAddress: true,
      reviewStatus: true,
      triageStatus: true,
      archivedAt: true,
      status: true
    }
  });
}

function buildBackfillUpdate(
  call: CandidateCall,
  extracted: Awaited<ReturnType<typeof extractCallData>>
): BackfillUpdate {
  const update: BackfillUpdate = {};

  if (call.leadName === null && extracted.leadName !== null) {
    update.leadName = extracted.leadName;
  }

  if (call.leadPhone === null && extracted.leadPhone !== null) {
    update.leadPhone = extracted.leadPhone;
  }

  if (call.leadIntent === null && extracted.leadIntent !== null) {
    update.leadIntent = extracted.leadIntent;
  }

  if (call.urgency === null && extracted.urgency !== null) {
    update.urgency = extracted.urgency;
  }

  if (call.serviceAddress === null && extracted.serviceAddress !== null) {
    update.serviceAddress = extracted.serviceAddress;
  }

  if (call.summary === null && extracted.summary !== null) {
    update.summary = extracted.summary;
  }

  return update;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const noTranscriptCount = await prisma.call.count({
    where: buildNoTranscriptWhere(args.callSid)
  });

  const candidates = await loadCandidates(args);

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let wouldUpdate = 0;

  console.log(
    JSON.stringify(
      {
        phase: 'call-enrichment-backfill',
        dryRun: args.dryRun,
        limit: args.limit,
        callSid: args.callSid,
        candidatesFound: candidates.length,
        noTranscriptCount
      },
      null,
      2
    )
  );

  if (args.callSid && candidates.length === 0) {
    skipped = 1;

    console.log(
      JSON.stringify(
        {
          ok: true,
          reason: 'requested callSid was not an eligible candidate',
          callSid: args.callSid,
          processed,
          updated,
          skipped,
          failed,
          noTranscriptCount
        },
        null,
        2
      )
    );

    return;
  }

  for (const call of candidates) {
    processed += 1;

    try {
      const extracted = await extractCallData({
        callerTranscript: call.callerTranscript,
        assistantTranscript: call.assistantTranscript
      });

      const update = buildBackfillUpdate(call, extracted);

      if (Object.keys(update).length === 0) {
        skipped += 1;

        console.log(
          JSON.stringify(
            {
              callSid: call.twilioCallSid,
              status: 'skipped',
              reason: 'extraction produced no safe backfill changes'
            },
            null,
            2
          )
        );
        continue;
      }

      if (args.dryRun) {
        wouldUpdate += 1;

        console.log(
          JSON.stringify(
            {
              callSid: call.twilioCallSid,
              status: 'dry-run',
              update
            },
            null,
            2
          )
        );
        continue;
      }

      await prisma.call.update({
        where: { id: call.id },
        data: update
      });

      updated += 1;

      console.log(
        JSON.stringify(
            {
              callSid: call.twilioCallSid,
              status: 'updated',
              update
            },
            null,
            2
        )
      );
    } catch (error) {
      failed += 1;

      console.error(
        JSON.stringify(
          {
            callSid: call.twilioCallSid,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          },
          null,
          2
        )
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: failed === 0,
        dryRun: args.dryRun,
        candidatesFound: candidates.length,
        processed,
        updated,
        skipped,
        failed,
        wouldUpdate,
        noTranscriptCount
      },
      null,
      2
    )
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();
