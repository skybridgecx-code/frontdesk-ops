# Retell Sandbox Webhook Testing Runbook

## Purpose

This runbook explains how to manually test the sandbox Retell webhook ingress added in parallel to the existing Twilio production voice path.

This is sandbox-only.
It does not cut over production voice.

## Current route

- POST /v1/twilio/retell/webhook

This temporary route lives under /v1/twilio/* in this phase so it can reuse current webhook auth-skip behavior without widening scope.

## Public webhook URL to register

Path:

- `/v1/twilio/retell/webhook`

Current production API host in this repo:

- `https://frontdesk-ops.onrender.com/v1/twilio/retell/webhook`

If your API host differs, use:

- `${FRONTDESK_API_PUBLIC_URL}/v1/twilio/retell/webhook`

## Retell events to enable (exact)

Enable exactly:

1. `call_ended`
2. `call_analyzed`

Do not enable additional Retell webhook events in this phase.

## Current webhook security state

- Retell signature verification (`x-retell-signature`) is not implemented in this route yet.
- This route is currently reachable under `/v1/twilio/*` webhook auth-skip behavior by design for sandbox testing.
- Keep this webhook configuration on sandbox-only Retell agents/workspaces during this phase.

## Phase 2E sandbox ownership fallback (browser/web-call)

Use this only when Retell browser/web-call payloads do not include enough phone-number ownership context and `/v1/twilio/retell/webhook` returns `202`.

Required env vars for fallback:

- `FRONTDESK_RETELL_SANDBOX_TENANT_ID`
- `FRONTDESK_RETELL_SANDBOX_BUSINESS_ID`
- `FRONTDESK_RETELL_SANDBOX_PHONE_NUMBER_ID`

Optional hard scope by Retell agent id:

- `FRONTDESK_RETELL_SANDBOX_AGENT_IDS=agent_id_1,agent_id_2`

Fallback behavior order:

1. explicit Retell payload metadata ownership
2. destination-number ownership lookup (existing phone-number flow)
3. sandbox fallback via agent-id-gated env config above

## Supported sandbox behavior

The sandbox Retell webhook currently supports:

1. Call lifecycle status ingestion
2. Transcript / summary ingestion
3. Correlation to an existing Call, or safe recovery-create when enough ownership context is available
4. Persistence into the existing Call / CallEvent model
5. Compatibility with:
   - /v1/calls
   - /v1/calls/:callSid

## Temporary compatibility choices

To preserve current dashboard behavior during migration:

- Retell provider call ids may be stored in legacy-compatible call id fields
- Retell lifecycle evidence may be persisted using current UI-compatible event names such as twilio.status.*
- This is intentional for compatibility in the sandbox phase
- Naming will be cleaned up later in migration

## Minimum required payload shape

The route expects JSON.

At minimum, the payload must provide enough information to normalize one of:

- a status update
- a transcript / summary artifact

Practical minimum fields for status testing:
- provider call id
- call status
- destination number or explicit ownership metadata

Practical minimum fields for transcript / summary testing:
- provider call id
- transcript and/or summary (`analysis.*` or `call.call_analysis.*` are supported)

## Example status payload

{
  "event": "call_ended",
  "call": {
    "call_id": "retell-call-001",
    "from_number": "+15717199673",
    "to_number": "+12029359687",
    "direction": "inbound",
    "duration_ms": 42000,
    "status": "completed",
    "start_timestamp": "2026-04-19T15:00:00.000Z",
    "end_timestamp": "2026-04-19T15:00:42.000Z",
    "metadata": {
      "tenantId": "cmnwbau4b000pdq1wzpsuu030",
      "businessId": "cmnwbau4t000rdq1wy51de728",
      "phoneNumberId": "cmnv4akxq000udu1eylullyy6"
    }
  }
}

## Example transcript / summary payload

{
  "event": "call_analyzed",
  "call": {
    "call_id": "retell-call-001",
    "from_number": "+15717199673",
    "to_number": "+12029359687",
    "transcript": "Caller asked about emergency plumbing service for a leaking pipe.",
    "call_analysis": {
      "call_summary": "Emergency plumbing inquiry for active leak."
    }
  }
}

## Curl example: status payload

curl -sS -X POST "$API_URL/v1/twilio/retell/webhook" \
  -H "content-type: application/json" \
  --data '{
    "event": "call_ended",
    "call": {
      "call_id": "retell-call-001",
      "from_number": "+15717199673",
      "to_number": "+12029359687",
      "direction": "inbound",
      "duration_ms": 42000,
      "status": "completed",
      "start_timestamp": "2026-04-19T15:00:00.000Z",
      "end_timestamp": "2026-04-19T15:00:42.000Z",
      "metadata": {
        "tenantId": "cmnwbau4b000pdq1wzpsuu030",
        "businessId": "cmnwbau4t000rdq1wy51de728",
        "phoneNumberId": "cmnv4akxq000udu1eylullyy6"
      }
    }
  }' | jq

## Curl example: transcript / summary payload

curl -sS -X POST "$API_URL/v1/twilio/retell/webhook" \
  -H "content-type: application/json" \
  --data '{
    "event": "call_analyzed",
    "call": {
      "call_id": "retell-call-001",
      "from_number": "+15717199673",
      "to_number": "+12029359687",
      "transcript": "Caller asked about emergency plumbing service for a leaking pipe.",
      "call_analysis": {
        "call_summary": "Emergency plumbing inquiry for active leak."
      }
    }
  }' | jq

## Retell dashboard setup steps (manual)

Recommended: agent-level webhook on the sandbox voice agent.

1. Open Retell Dashboard -> agent detail page for the sandbox agent you will call.
2. Open the webhook configuration section on that agent detail page.
3. Paste webhook URL:
   - `https://frontdesk-ops.onrender.com/v1/twilio/retell/webhook`
4. Set webhook events to only:
   - `call_ended`
   - `call_analyzed`
5. Save webhook settings.

Alternative account-level location (if using account-level webhooks): Dashboard system settings -> Webhooks tab.

## One browser/web-call test

1. In Retell Dashboard, start one web call from the same sandbox agent.
2. Speak for 10-20 seconds so transcript and summary can be generated.
3. End the call.
4. Wait for post-call processing to complete (this is when `call_analyzed` is sent).

## Expected responses

200 OK
- payload normalized and persisted successfully

202 Accepted
- payload was valid enough to process, but the route could not correlate or safely recover-create a Call

400 Bad Request
- payload did not match the supported sandbox shape or was missing required fields

## Verification in existing APIs

Verify via /v1/calls:

curl -sS "$API_URL/v1/calls?limit=5" | jq

Verify via /v1/calls/:callSid:

curl -sS "$API_URL/v1/calls/retell-call-001" | jq

Or verify with the latest call sid from API:

CALL_SID=$(curl -sS "$API_URL/v1/calls?limit=1" | jq -r '.calls[0].twilioCallSid')
curl -sS "$API_URL/v1/calls/$CALL_SID" | jq

## Log verification aid (no deployed web UI)

On successful Retell webhook correlation/create (200 path), API logs now emit:

- `event: "retell.sandbox.webhook.correlated"`
- `providerCallId`
- `callId`
- `correlationSource`
- `createdFromWebhook`
- `applied.status`
- `applied.transcript`

Use this log event to confirm sandbox success when no Render-hosted web dashboard is available.

Current compatibility may rely on storing the Retell provider call id in legacy-compatible call id fields during the sandbox phase.

## Inbound DID elimination checklist (Telnyx -> Retell -> frontdesk)

Repo/backend path already proven when all are true:

1. Retell browser/web call appears in Retell Call History.
2. API logs show `event: "retell.sandbox.webhook.correlated"` with `providerCallId` and `callId`.
3. `GET /v1/calls` or `GET /v1/calls/:callSid` shows the correlated call record.

Boundary rule:

- If a real inbound DID call does **not** appear in Retell Call History, failure is before app webhook ingestion (Telnyx -> Retell provider routing boundary), not in this repo's webhook/persistence path.

Remaining manual provider-side checks:

1. Telnyx DID is active for inbound voice and assigned to the intended inbound connection/profile.
2. Telnyx inbound routing target is the Retell SIP/connection target you intend to use (not a stale Twilio/legacy target).
3. Retell has the same DID imported/attached in E.164 format and bound to the expected Retell agent.
4. Retell inbound handling for that number is enabled (agent/phone mapping is active, not draft/disabled).
5. Retell webhook settings for that agent/account still include:
   - `call_ended`
   - `call_analyzed`
6. Place one fresh DID test call and verify this sequence:
   - call appears in Retell Call History
   - then frontdesk API logs show `retell.sandbox.webhook.correlated`
   - then `/v1/calls` returns the call by `providerCallId`/`twilioCallSid`

Escalation split:

- Missing in Retell Call History: Telnyx/Retell telephony setup issue.
- Present in Retell Call History but no frontdesk webhook logs: Retell webhook delivery/config issue.
- Webhook logs present with 200 correlation but UI missing: app query/render contract investigation.

## Suggested manual test order

1. Post the example status payload
2. Confirm 200
3. Check /v1/calls
4. Check /v1/calls/:callSid
5. Post the example transcript / summary payload
6. Re-check /v1/calls/:callSid
7. Confirm summary / transcript fields updated as expected

## Current limitations

- Route path is temporary and sandbox-oriented
- Supported Retell payload subset is intentionally narrow
- Not all Retell event variants are mapped yet
- Compatibility currently prioritizes preserving existing dashboard contracts over provider-pure naming
- Production cutover is out of scope for this phase
