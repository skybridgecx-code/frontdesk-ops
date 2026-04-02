# MoLeads Pilot Runbook

This is the single source of truth for standing up, validating, and demoing the current pilot-ready product.

The product truth for this repo is simple:

- inbound calls become visible inbound work
- public requests become visible outbound work
- imported prospects become visible outbound work
- operators can review, update, contact, archive, and move to the next item needing attention

This runbook is optimized for a real pilot or live demo, not day-to-day development speed.

## What Pilot-Ready Means Here

For this repo, pilot-ready means:

1. the stack can be started cleanly
2. the bounded demo data can be reset reliably
3. an operator can enter the system and know what to do first
4. inbound and outbound work can both be demonstrated from truthful queue states
5. public lead capture visibly hands off into the same operator workflow

## Pilot Stack

Run these in separate terminals from the repo root.

### Terminal 1: Postgres

```bash
cd /Users/muhammadaatif/frontdesk-os
docker compose -f docker/compose/local.yml up -d postgres
```

### Terminal 2: API

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/api dev
```

The API should listen on:

- [http://127.0.0.1:4000](http://127.0.0.1:4000)

### Terminal 3: Stable web server

For pilot demos, use the built web server instead of `next dev`.

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter web build
pnpm --filter web exec next start -H 127.0.0.1 -p 3001
```

Open the app at:

- [http://127.0.0.1:3001/](http://127.0.0.1:3001/)

Why `3001`:

- `3000` may already be occupied locally, often by Docker
- `3001` is the stable local pilot/demo port used in this repo

## Reset And Validate Before Demo

Run this before a pilot session or product walkthrough:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm validate:local-operator
```

If you want the slower, fuller pass:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm validate:local-operator:full
```

Both commands assume:

- Postgres is running
- API is running on `127.0.0.1:4000`

## Bounded Demo Baseline

The bounded demo validation surface is:

- calls:
  - `CA_DEMO_101` through `CA_DEMO_106`
- prospects:
  - `PR_DEMO_101` through `PR_DEMO_106`

After reset and smoke, the expected baseline is:

- `reviewNext = CA_DEMO_101`
- call queue first two = `CA_DEMO_101`, `CA_DEMO_102`
- `prospectReviewNext = PR_DEMO_101`
- prospect queue first two = `PR_DEMO_101`, `PR_DEMO_102`

If manual testing drifts the rows, restore with:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/db reset:demo-calls
pnpm --filter @frontdesk/db smoke:demo-calls
```

## Operator First-Run Path

This is the shortest truthful path for a first-time operator.

### Inbound work

Open:

- [http://127.0.0.1:3001/calls?triageStatus=OPEN](http://127.0.0.1:3001/calls?triageStatus=OPEN)

Do this:

1. Start with `CA_DEMO_101`
2. Review summary, caller details, urgency, and review status
3. Save changes or mark contacted
4. Use `Review next` to move to the next call needing attention

### Outbound work

Open:

- [http://127.0.0.1:3001/prospects?status=READY](http://127.0.0.1:3001/prospects?status=READY)

Do this:

1. Start with `PR_DEMO_101`
2. Review source context, contact details, and source intelligence
3. Save changes or log activity
4. Use `Save and review next` or queue-level `Review next`

### Public front door handoff

Open:

- [http://127.0.0.1:3001/](http://127.0.0.1:3001/)
- or [http://127.0.0.1:3001/contact](http://127.0.0.1:3001/contact)

Do this:

1. Submit a workflow review request
2. Confirm success state
3. Open the outbound queue
4. Confirm the request entered the prospect workflow as a real work item

## Demo Narrative That Matches Product Truth

Use this story in a pilot:

1. Demand shows up:
   - phone call
   - website request
   - imported prospect list
2. The system turns that demand into visible work
3. The operator can review it, update it, and move it forward
4. Nothing relies on vague memory or disconnected forms

Avoid claiming:

- full CRM replacement
- dashboard-heavy analytics
- speculative AI automation
- broad account-management depth

The honest wedge is:

- stopping leads from dying between first contact and follow-up

## Environment Notes

Useful local env values:

```bash
FRONTDESK_API_BASE_URL=http://127.0.0.1:4000
FRONTDESK_APP_BASE_URL=http://127.0.0.1:3001
```

Optional explicit operator workspace selection:

```bash
FRONTDESK_ACTIVE_TENANT_SLUG=<tenant-slug>
FRONTDESK_ACTIVE_BUSINESS_SLUG=<business-slug>
```

If `FRONTDESK_ACTIVE_TENANT_SLUG` is set, `/v1/bootstrap` will only resolve that tenant.
If the tenant slug does not exist, bootstrap returns `tenant: null` instead of silently selecting a different tenant.
If `FRONTDESK_ACTIVE_BUSINESS_SLUG` is also set, that business is surfaced first in the returned tenant payload.

Optional operator notification:

```bash
FRONTDESK_OPERATOR_WEBHOOK_URL=<webhook url>
```

## Demo Recovery Checklist

If the demo feels off:

1. confirm Postgres is up
2. confirm API is listening on `127.0.0.1:4000`
3. confirm web is running on `127.0.0.1:3001`
4. run:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/db reset:demo-calls
pnpm --filter @frontdesk/db smoke:demo-calls
```

5. reopen:
   - `/calls?triageStatus=OPEN`
   - `/prospects?status=READY`
