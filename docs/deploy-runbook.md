# Frontdesk Deploy Runbook

## Service split

- Vercel hosts `apps/web`
- Render hosts `apps/api`
- Render hosts `apps/realtime-gateway`

## Required env vars

### Web (`apps/web`)

- `FRONTDESK_API_BASE_URL=https://frontdesk-ops.onrender.com`
- `FRONTDESK_REQUIRE_BASIC_AUTH=true`
- `FRONTDESK_BASIC_AUTH_USER=<ops user>`
- `FRONTDESK_BASIC_AUTH_PASS=<ops password>`
- `FRONTDESK_INTERNAL_API_SECRET=<shared secret>`

### API (`apps/api`)

- `DATABASE_URL=<Render service DATABASE_URL>`
- `TWILIO_ACCOUNT_SID=<Twilio account SID>`
- `TWILIO_AUTH_TOKEN=<Twilio auth token>`
- `FRONTDESK_API_PUBLIC_URL=https://<api-host>`
- `FRONTDESK_REALTIME_WS_BASE_URL=wss://frontdesk-realtime.onrender.com/ws/media-stream`
- `FRONTDESK_REQUIRE_BASIC_AUTH=true`
- `FRONTDESK_BASIC_AUTH_USER=<ops user>`
- `FRONTDESK_BASIC_AUTH_PASS=<ops password>`
- `FRONTDESK_INTERNAL_API_SECRET=<shared secret>`

### Realtime gateway (`apps/realtime-gateway`)

- `DATABASE_URL=<Render service DATABASE_URL>`
- `FRONTDESK_INTERNAL_API_SECRET=<shared secret>`
- `OPENAI_API_KEY=<OpenAI key>`
- `OPENAI_REALTIME_MODEL=<realtime model>`
- `OPENAI_EXTRACTION_MODEL=<extraction model>`

`FRONTDESK_INTERNAL_API_SECRET` must match exactly between API and realtime gateway.

## Render commands

Use the repo root as the working directory for both Render services.

### API

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @frontdesk/db exec prisma generate && pnpm --filter @frontdesk/db exec prisma migrate deploy && pnpm --filter @frontdesk/api build`
- Start command: `node --import tsx apps/api/src/index.ts`

### Realtime gateway

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @frontdesk/db exec prisma generate && pnpm --filter @frontdesk/realtime-gateway build`
- Start command: `PORT_REALTIME=$PORT node --import tsx apps/realtime-gateway/src/index.ts`

The realtime gateway must be publicly reachable over `wss` at `wss://frontdesk-realtime.onrender.com/ws/media-stream`.

## Twilio

- Voice webhook: `https://frontdesk-ops.onrender.com/v1/twilio/voice/inbound`

## Production voice deploy and smoke

### Deploy order

1. Deploy `frontdesk-realtime`
2. Deploy `frontdesk-ops`

### Render env parity

API (`frontdesk-ops`) must include:

- `DATABASE_URL`
- `FRONTDESK_INTERNAL_API_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `FRONTDESK_API_PUBLIC_URL`
- `FRONTDESK_REALTIME_WS_BASE_URL`

Realtime (`frontdesk-realtime`) must include:

- `DATABASE_URL`
- `FRONTDESK_INTERNAL_API_SECRET`
- `OPENAI_API_KEY`

URL shape requirements:

- `FRONTDESK_API_PUBLIC_URL=https://<api-host>`
- `FRONTDESK_REALTIME_WS_BASE_URL=wss://<realtime-host>/ws/media-stream`

Current production values:

- `FRONTDESK_API_PUBLIC_URL=https://frontdesk-ops.onrender.com`
- `FRONTDESK_REALTIME_WS_BASE_URL=wss://frontdesk-realtime.onrender.com/ws/media-stream`

### Attach existing number (production template)

```bash
export API_URL="https://frontdesk-ops.onrender.com"
export FRONTDESK_INTERNAL_API_SECRET="<shared-secret>"

curl -sS -X POST "$API_URL/v1/admin/provisioning/attach-existing-number" \
  -H "authorization: Bearer $FRONTDESK_INTERNAL_API_SECRET" \
  -H "content-type: application/json" \
  --data '{
    "tenantId":"cmnwbau4b000pdq1wzpsuu030",
    "businessId":"cmnwbau4t000rdq1wy51de728",
    "phoneNumber":"+12029359687"
  }' | jq
```

### Production DB proof queries

```sql
WITH latest AS (
  SELECT id, "twilioCallSid", "createdAt"
  FROM "Call"
  WHERE "toE164" = '+12029359687'
  ORDER BY "createdAt" DESC
  LIMIT 1
)
SELECT
  l.id,
  l."twilioCallSid",
  EXISTS (SELECT 1 FROM "CallEvent" e WHERE e."callId" = l.id AND e.type = 'twilio.media.start') AS has_media_start,
  EXISTS (SELECT 1 FROM "CallEvent" e WHERE e."callId" = l.id AND e.type = 'openai.ws.connected') AS has_openai_ws,
  EXISTS (SELECT 1 FROM "CallEvent" e WHERE e."callId" = l.id AND e.type IN ('openai.output_audio.delta','twilio.outbound.media.sent')) AS has_openai_audio_out
FROM latest l;
```

```sql
WITH latest AS (
  SELECT id
  FROM "Call"
  WHERE "toE164" = '+12029359687'
  ORDER BY "createdAt" DESC
  LIMIT 1
)
SELECT
  e.sequence,
  e.type,
  e."payloadJson"::jsonb ->> 'authSource' AS auth_source,
  e."createdAt"
FROM "CallEvent" e
JOIN latest l ON e."callId" = l.id
WHERE e.type = 'twilio.media.start'
ORDER BY e.sequence
LIMIT 1;
```

### Incident note and operator guidance

- A Twilio `502` timeout on `/v1/twilio/voice/inbound` and `/v1/twilio/voice/status` before TwiML/stream start should be treated as API availability first (for example cold start/unavailable API), not a proven realtime code-path bug.
- If Twilio Inspector shows inbound `502` before TwiML, warm or redeploy `frontdesk-ops` and retest before editing code.

## Database and bootstrap

- Apply production migrations with `pnpm --filter @frontdesk/db prisma:migrate:deploy`
- Run bootstrap after the first database setup with `pnpm --filter @frontdesk/db bootstrap:demo`
- Bootstrap is rerunnable and should not wipe existing data
- Laptop-side Prisma commands must use the external database URL
- Render services should use their service `DATABASE_URL`

## Validation

After bootstrap and service deploys are in place, validate with:

`WEB_URL=https://frontdesk-ops-web.vercel.app API_URL=https://frontdesk-ops.onrender.com OPS_USER=<ops user> OPS_PASS=<ops pass> ./scripts/prod-smoke.sh`

The smoke now covers:

- public web access on `/`
- protected operator access on `/calls` and `/prospects`
- authenticated bootstrap and prospect reads
- a prospect import plus update/attempt path
- terminal read-state reflection on the prospect detail path
