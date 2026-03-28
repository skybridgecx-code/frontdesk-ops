export {};

const API_BASE_URL = 'http://127.0.0.1:4000';

type ReviewNextResponse = {
  ok: true;
  callSid: string | null;
};

type ProspectReviewNextResponse = {
  ok: true;
  prospectSid: string | null;
};

type CallListItem = {
  twilioCallSid: string;
  triageStatus: string;
  reviewStatus: string;
  urgency: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  summary: string | null;
};

type CallsResponse = {
  ok: true;
  calls: CallListItem[];
};

type ProspectListItem = {
  prospectSid: string;
  status: string;
  priority: string | null;
};

type ProspectsResponse = {
  ok: true;
  prospects: ProspectListItem[];
};

type CallDetail = {
  twilioCallSid: string;
  triageStatus: string;
  reviewStatus: string;
  urgency: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  summary: string | null;
};

type CallDetailResponse = {
  ok: true;
  call: CallDetail;
};

type ProspectDetail = {
  prospectSid: string;
  status: string;
  priority: string | null;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  notes: string | null;
  attempts: Array<{
    channel: string;
    outcome: string;
    attemptedAt: string;
  }>;
};

type ProspectDetailResponse = {
  ok: true;
  prospect: ProspectDetail;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

function assertCheck(condition: unknown, message: string, failures: string[]) {
  if (!condition) {
    failures.push(message);
  }
}

async function main() {
  const failures: string[] = [];

  try {
    const [
      reviewNext,
      prospectReviewNext,
      queue,
      prospects,
      call101,
      call103,
      call106,
      prospect101,
      prospect103,
      prospect106
    ] = await Promise.all([
      getJson<ReviewNextResponse>('/v1/calls/review-next'),
      getJson<ProspectReviewNextResponse>('/v1/prospects/review-next'),
      getJson<CallsResponse>('/v1/calls?limit=5&page=1'),
      getJson<ProspectsResponse>('/v1/prospects?limit=5&page=1'),
      getJson<CallDetailResponse>('/v1/calls/CA_DEMO_101'),
      getJson<CallDetailResponse>('/v1/calls/CA_DEMO_103'),
      getJson<CallDetailResponse>('/v1/calls/CA_DEMO_106'),
      getJson<ProspectDetailResponse>('/v1/prospects/PR_DEMO_101'),
      getJson<ProspectDetailResponse>('/v1/prospects/PR_DEMO_103'),
      getJson<ProspectDetailResponse>('/v1/prospects/PR_DEMO_106')
    ]);

    assertCheck(reviewNext.callSid === 'CA_DEMO_101', `review-next expected CA_DEMO_101, got ${reviewNext.callSid}`, failures);
    assertCheck(
      prospectReviewNext.prospectSid === 'PR_DEMO_101',
      `prospect review-next expected PR_DEMO_101, got ${prospectReviewNext.prospectSid}`,
      failures
    );

    const queueFirstTwo = queue.calls.slice(0, 2).map((call) => call.twilioCallSid);
    assertCheck(
      queueFirstTwo[0] === 'CA_DEMO_101' && queueFirstTwo[1] === 'CA_DEMO_102',
      `queue expected first two calls [CA_DEMO_101, CA_DEMO_102], got [${queueFirstTwo.join(', ')}]`,
      failures
    );

    const prospectFirstTwo = prospects.prospects.slice(0, 2).map((prospect) => prospect.prospectSid);
    assertCheck(
      prospectFirstTwo[0] === 'PR_DEMO_101' && prospectFirstTwo[1] === 'PR_DEMO_102',
      `prospect queue expected first two prospects [PR_DEMO_101, PR_DEMO_102], got [${prospectFirstTwo.join(', ')}]`,
      failures
    );

    assertCheck(call101.call.triageStatus === 'OPEN', `CA_DEMO_101 triageStatus expected OPEN, got ${call101.call.triageStatus}`, failures);
    assertCheck(
      call101.call.reviewStatus === 'UNREVIEWED',
      `CA_DEMO_101 reviewStatus expected UNREVIEWED, got ${call101.call.reviewStatus}`,
      failures
    );
    assertCheck(call101.call.urgency === 'high', `CA_DEMO_101 urgency expected high, got ${call101.call.urgency}`, failures);
    assertCheck(Boolean(call101.call.callerTranscript), 'CA_DEMO_101 expected caller transcript', failures);
    assertCheck(Boolean(call101.call.assistantTranscript), 'CA_DEMO_101 expected assistant transcript', failures);

    assertCheck(
      call103.call.reviewStatus === 'NEEDS_REVIEW',
      `CA_DEMO_103 reviewStatus expected NEEDS_REVIEW, got ${call103.call.reviewStatus}`,
      failures
    );
    assertCheck(call103.call.urgency === 'emergency', `CA_DEMO_103 urgency expected emergency, got ${call103.call.urgency}`, failures);
    assertCheck(Boolean(call103.call.callerTranscript), 'CA_DEMO_103 expected caller transcript', failures);
    assertCheck(Boolean(call103.call.assistantTranscript), 'CA_DEMO_103 expected assistant transcript', failures);

    assertCheck(call106.call.triageStatus === 'OPEN', `CA_DEMO_106 triageStatus expected OPEN, got ${call106.call.triageStatus}`, failures);
    assertCheck(
      call106.call.reviewStatus === 'UNREVIEWED',
      `CA_DEMO_106 reviewStatus expected UNREVIEWED, got ${call106.call.reviewStatus}`,
      failures
    );
    assertCheck(Boolean(call106.call.callerTranscript), 'CA_DEMO_106 expected caller transcript', failures);
    assertCheck(Boolean(call106.call.assistantTranscript), 'CA_DEMO_106 expected assistant transcript', failures);
    assertCheck(
      call106.call.summary === null || call106.call.urgency === null,
      'CA_DEMO_106 expected intentionally partial/thin state',
      failures
    );

    assertCheck(
      prospect101.prospect.status === 'READY',
      `PR_DEMO_101 status expected READY, got ${prospect101.prospect.status}`,
      failures
    );
    assertCheck(
      prospect101.prospect.priority === 'HIGH',
      `PR_DEMO_101 priority expected HIGH, got ${prospect101.prospect.priority}`,
      failures
    );
    assertCheck(Boolean(prospect101.prospect.contactPhone), 'PR_DEMO_101 expected contact phone', failures);

    assertCheck(
      prospect103.prospect.status === 'ATTEMPTED',
      `PR_DEMO_103 status expected ATTEMPTED, got ${prospect103.prospect.status}`,
      failures
    );
    assertCheck(
      prospect103.prospect.priority === 'HIGH',
      `PR_DEMO_103 priority expected HIGH, got ${prospect103.prospect.priority}`,
      failures
    );
    assertCheck(prospect103.prospect.attempts.length > 0, 'PR_DEMO_103 expected at least one attempt', failures);

    assertCheck(
      prospect106.prospect.status === 'ARCHIVED',
      `PR_DEMO_106 status expected ARCHIVED, got ${prospect106.prospect.status}`,
      failures
    );
    assertCheck(
      prospect106.prospect.attempts.length > 0,
      'PR_DEMO_106 expected archived attempt history',
      failures
    );

    if (failures.length > 0) {
      console.error(
        JSON.stringify(
          {
            ok: false,
            apiBaseUrl: API_BASE_URL,
            failures
          },
          null,
          2
        )
      );
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          apiBaseUrl: API_BASE_URL,
          reviewNext: reviewNext.callSid,
          prospectReviewNext: prospectReviewNext.prospectSid,
          queueFirstTwo,
          prospectFirstTwo,
          checked: {
            CA_DEMO_101: {
              triageStatus: call101.call.triageStatus,
              reviewStatus: call101.call.reviewStatus,
              urgency: call101.call.urgency,
              hasCallerTranscript: Boolean(call101.call.callerTranscript),
              hasAssistantTranscript: Boolean(call101.call.assistantTranscript)
            },
            CA_DEMO_103: {
              triageStatus: call103.call.triageStatus,
              reviewStatus: call103.call.reviewStatus,
              urgency: call103.call.urgency,
              hasCallerTranscript: Boolean(call103.call.callerTranscript),
              hasAssistantTranscript: Boolean(call103.call.assistantTranscript)
            },
            CA_DEMO_106: {
              triageStatus: call106.call.triageStatus,
              reviewStatus: call106.call.reviewStatus,
              urgency: call106.call.urgency,
              hasCallerTranscript: Boolean(call106.call.callerTranscript),
              hasAssistantTranscript: Boolean(call106.call.assistantTranscript),
              hasSummary: Boolean(call106.call.summary)
            },
            PR_DEMO_101: {
              status: prospect101.prospect.status,
              priority: prospect101.prospect.priority,
              hasContactPhone: Boolean(prospect101.prospect.contactPhone)
            },
            PR_DEMO_103: {
              status: prospect103.prospect.status,
              priority: prospect103.prospect.priority,
              attemptCount: prospect103.prospect.attempts.length
            },
            PR_DEMO_106: {
              status: prospect106.prospect.status,
              priority: prospect106.prospect.priority,
              attemptCount: prospect106.prospect.attempts.length
            }
          }
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          apiBaseUrl: API_BASE_URL,
          error: error instanceof Error ? error.message : String(error)
        },
        null,
        2
      )
    );
    process.exit(1);
  }
}

void main();
