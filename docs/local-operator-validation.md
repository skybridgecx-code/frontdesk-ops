# Local Operator Validation Runbook

For the full pilot/demo flow, use [`docs/pilot-runbook.md`](./pilot-runbook.md).

Use this runbook before manual queue/detail/review workflow testing.

## Prerequisites

Start local Postgres:

```bash
docker compose -f docker/compose/local.yml up -d postgres
```

Start the API in a separate terminal:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/api dev
```

If you want to exercise the web workflow directly for a pilot/demo, start the built web app in another terminal:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter web build
pnpm --filter web exec next start -H 127.0.0.1 -p 3001
```

The local smoke checks expect the API at `http://127.0.0.1:4000`.
The stable local pilot/demo web port is `http://127.0.0.1:3001`.
If you are running against a non-demo tenant, set `FRONTDESK_ACTIVE_TENANT_SLUG` and optionally `FRONTDESK_ACTIVE_BUSINESS_SLUG` so `/v1/bootstrap` resolves the intended active workspace.

## Fast Local Validation

Run the bounded fast loop:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm validate:local-operator
```

This runs:

1. `pnpm --filter @frontdesk/db test`
2. `pnpm --filter @frontdesk/api test`
3. `pnpm --filter web test`
4. `pnpm --filter @frontdesk/db reset:demo-calls`
5. `pnpm --filter @frontdesk/db smoke:demo-calls`

Use this for frequent local checks while iterating.

## Full Local Validation

Run the slower full-confidence bundle before handoff or PR prep:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm validate:local-operator:full
```

This runs the fast loop plus:

1. `pnpm --filter @frontdesk/db build`
2. `pnpm --filter @frontdesk/api build`
3. `pnpm --filter web build`

## Bounded Demo Reset

If local demo rows drift after manual testing, restore only the bounded demo set:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/db reset:demo-calls
```

This resets the bounded demo validation surface back to the seeded baseline:

- `CA_DEMO_101` through `CA_DEMO_106`
- `PR_DEMO_101` through `PR_DEMO_106`

## Bounded Demo Smoke

To verify the bounded demo validation surface directly:

```bash
cd /Users/muhammadaatif/frontdesk-os
pnpm --filter @frontdesk/db smoke:demo-calls
```

## Healthy Baseline At A Glance

After reset, the smoke check should report:

- `reviewNext = CA_DEMO_101`
- queue first two calls = `CA_DEMO_101`, `CA_DEMO_102`
- `CA_DEMO_101 = OPEN / UNREVIEWED / high`
- `CA_DEMO_103 = OPEN / NEEDS_REVIEW / emergency`
- `CA_DEMO_106 = OPEN / UNREVIEWED / intentionally thin`
- `prospectReviewNext = PR_DEMO_101`
- prospect first two = `PR_DEMO_101`, `PR_DEMO_102`
- `PR_DEMO_101 = READY / HIGH`
- `PR_DEMO_103 = ATTEMPTED / HIGH`
- `PR_DEMO_106 = ARCHIVED`

## Manual UI Entry Points

After reset + smoke, the bounded local UI entry points are:

- Inbound queue: [http://127.0.0.1:3001/calls?triageStatus=OPEN](http://127.0.0.1:3001/calls?triageStatus=OPEN)
- Outbound queue: [http://127.0.0.1:3001/prospects?status=READY](http://127.0.0.1:3001/prospects?status=READY)

The expected outbound UI path is:

1. Open `/prospects?status=READY`
2. Confirm the queue starts with `PR_DEMO_101`, then `PR_DEMO_102`
3. Open `PR_DEMO_101`
4. Save changes or use `Save and review next`
5. Confirm the flow stays in scoped prospect queue context or falls back cleanly with `No prospects currently need follow-up.`

## Quick Note

- Live local demo rows can drift after manual testing.
- `reset:demo-calls` restores the bounded demo baseline for both call and prospect fixtures.
- `smoke:demo-calls` is read-only and fails clearly if the bounded call/prospect validation surface is off.
- If `validate:local-operator` fails with `fetch failed`, confirm the API is actually running on `127.0.0.1:4000`.
