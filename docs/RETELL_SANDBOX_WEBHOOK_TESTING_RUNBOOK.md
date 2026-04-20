# Retell Sandbox Webhook Testing Runbook

## Purpose

This runbook explains how to manually test the sandbox Retell webhook ingress added in parallel to the existing Twilio production voice path.

This is sandbox-only.
It does not cut over production voice.

## Current route

- POST /v1/twilio/retell/webhook

This temporary route lives under /v1/twilio/* in this phase so it can reuse current webhook auth-skip behavior without widening scope.

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
- transcript and/or summary

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
    "to_number": "+12029359687"
  },
  "analysis": {
    "transcript": "Caller asked about emergency plumbing service for a leaking pipe.",
    "summary": "Emergency plumbing inquiry for active leak."
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
      "to_number": "+12029359687"
    },
    "analysis": {
      "transcript": "Caller asked about emergency plumbing service for a leaking pipe.",
      "summary": "Emergency plumbing inquiry for active leak."
    }
  }' | jq

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

Current compatibility may rely on storing the Retell provider call id in legacy-compatible call id fields during the sandbox phase.

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
