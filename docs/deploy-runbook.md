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
- `FRONTDESK_REALTIME_WS_BASE_URL=wss://frontdesk-realtime.onrender.com/ws/media-stream`
- `FRONTDESK_REQUIRE_BASIC_AUTH=true`
- `FRONTDESK_BASIC_AUTH_USER=<ops user>`
- `FRONTDESK_BASIC_AUTH_PASS=<ops password>`
- `FRONTDESK_INTERNAL_API_SECRET=<shared secret>`

### Realtime gateway (`apps/realtime-gateway`)

- `DATABASE_URL=<Render service DATABASE_URL>`
- `OPENAI_API_KEY=<OpenAI key>`
- `OPENAI_REALTIME_MODEL=<realtime model>`
- `OPENAI_EXTRACTION_MODEL=<extraction model>`

`FRONTDESK_INTERNAL_API_SECRET` must match between web and api.

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
