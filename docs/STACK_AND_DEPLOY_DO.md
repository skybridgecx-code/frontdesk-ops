# SkyBridgeCX — Production Stack & Deploy (DigitalOcean + Retell + Telnyx)

This document replaces `deploy-runbook.md` (Vercel + Render + Twilio + raw OpenAI Realtime). It is the source of truth for how the product is hosted and what services it depends on.

## Final stack (v1)

| Layer | Service | Why |
|---|---|---|
| Web (dashboard + landing) | DigitalOcean App Platform — Web Service from `apps/web` | One bill, Docker-friendly, supports Next.js standalone build. |
| API | DigitalOcean App Platform — Web Service from `apps/api` (Dockerfile already exists) | Public HTTPS, env vars, autoscale. |
| Database | DigitalOcean Managed Postgres (1 node, 1GB to start) | Same network as App Platform, low latency, automatic backups. |
| Voice agent | **Retell** | Hosted realtime LLM voice agent. Replaces the local `apps/realtime-gateway` service. |
| Telephony / numbers | **Telnyx** | E.164 number provisioning + SIP routing into Retell. |
| Auth | Clerk | Already wired. |
| Billing | Stripe | Already wired (checkout + portal + webhooks). |
| Email | Resend | Already wired. |
| Errors / logs | Sentry (TODO) + DO App Platform logs | See `LAUNCH_CHECKLIST.md`. |

> **Deprecated:** `apps/realtime-gateway` is no longer deployed. Retell handles the OpenAI Realtime connection. The package can stay in the repo (its prompt logic mirrors what we send to Retell) but it is not built or run in production.

## DigitalOcean App Platform — `app.yaml`

Save the following as `do.app.yaml` at the repo root and create the app via:

```
doctl apps create --spec do.app.yaml
```

```yaml
name: skybridgecx
region: nyc
features:
  - buildpack-stack=ubuntu-22

databases:
  - name: skybridgecx-db
    engine: PG
    production: true
    cluster_name: skybridgecx-db

services:
  - name: api
    dockerfile_path: apps/api/Dockerfile
    source_dir: /
    http_port: 4000
    instance_size_slug: basic-xs
    instance_count: 1
    routes:
      - path: /v1
      - path: /healthz
    health_check:
      http_path: /healthz
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT_API
        value: "4000"
      - key: DATABASE_URL
        value: ${skybridgecx-db.DATABASE_URL}
        type: SECRET
      - key: FRONTDESK_API_PUBLIC_URL
        value: ${APP_URL}
      - key: FRONTDESK_INTERNAL_API_SECRET
        value: ${FRONTDESK_INTERNAL_API_SECRET}
        type: SECRET
      - key: CLERK_SECRET_KEY
        type: SECRET
      - key: STRIPE_SECRET_KEY
        type: SECRET
      - key: STRIPE_WEBHOOK_SECRET
        type: SECRET
      - key: STRIPE_PRICE_ID_STARTER
        type: SECRET
      - key: STRIPE_PRICE_ID_PRO
        type: SECRET
      - key: STRIPE_PRICE_ID_ENTERPRISE
        type: SECRET
      - key: TELNYX_API_KEY
        type: SECRET
      - key: TELNYX_MESSAGING_PROFILE_ID
        type: SECRET
      - key: TELNYX_VOICE_PROFILE_ID
        type: SECRET
      - key: TELNYX_CONNECTION_ID
        type: SECRET
      - key: RETELL_API_KEY
        type: SECRET
      - key: RETELL_AGENT_ID_HOME_SERVICES
        type: SECRET
      - key: RETELL_WEBHOOK_SECRET
        type: SECRET
      - key: RESEND_API_KEY
        type: SECRET
      - key: NOTIFICATION_FROM_EMAIL
        value: SkyBridgeCX <notifications@skybridgecx.com>
      - key: SENTRY_DSN
        type: SECRET

  - name: web
    dockerfile_path: docker/web.Dockerfile  # see "Web Dockerfile" below
    source_dir: /
    http_port: 3000
    instance_size_slug: basic-xs
    instance_count: 1
    routes:
      - path: /
    health_check:
      http_path: /
    envs:
      - key: NODE_ENV
        value: production
      - key: PORT_WEB
        value: "3000"
      - key: NEXT_PUBLIC_API_URL
        value: ${api.PUBLIC_URL}
      - key: FRONTDESK_API_BASE_URL
        value: ${api.PUBLIC_URL}
      - key: FRONTDESK_INTERNAL_API_SECRET
        value: ${FRONTDESK_INTERNAL_API_SECRET}
        type: SECRET
      - key: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
      - key: CLERK_SECRET_KEY
        type: SECRET
      - key: NEXT_PUBLIC_CLERK_SIGN_IN_URL
        value: /sign-in
      - key: NEXT_PUBLIC_CLERK_SIGN_UP_URL
        value: /sign-up
      - key: NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL
        value: /dashboard
      - key: NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL
        value: /onboarding
      - key: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      - key: NEXT_PUBLIC_ADMIN_EMAILS
      - key: SENTRY_DSN
        type: SECRET

domains:
  - domain: skybridgecx.com
    type: PRIMARY
    zone: skybridgecx.com
  - domain: app.skybridgecx.com
    type: ALIAS
    zone: skybridgecx.com
```

> **CRITICAL:** the values that previously lived in `.env.vercel.check` had several breaking issues — `STRIPE_WEBHOOK_SECRET` was set to a `pk_test_…` publishable key (signature verification would silently fail), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` was `pk_test_placeholder`, and several values had a literal trailing `\n` (e.g. `/welcome\n`). Do not copy that file forward — set the values fresh in DigitalOcean.

## Web Dockerfile

The `apps/web` directory only ships a Next.js source tree; create `docker/web.Dockerfile`:

```Dockerfile
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# Install deps with workspace context
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

# Build
COPY apps/web ./apps/web
RUN pnpm --filter @frontdesk/web build

# Runtime
FROM node:22-alpine
WORKDIR /app
COPY --from=base /repo/apps/web/.next ./.next
COPY --from=base /repo/apps/web/public ./public
COPY --from=base /repo/apps/web/package.json ./package.json
COPY --from=base /repo/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
```

(Adjust if you turn on `output: 'standalone'` in `next.config.ts` — recommended.)

## Telnyx setup (one time)

1. Create a Telnyx account; turn on the **Voice API**.
2. Create a **Voice API Connection** pointed at Retell's SIP URI (Retell → Phone → SIP — copy the URI). Note the `connection_id`.
3. Create a **Voice Profile** (default codec g711, dtmf in-band off).
4. (Optional) Messaging Profile if you plan to send SMS lead alerts.
5. Buy a sandbox number in the dashboard, dial it, confirm Retell rings.
6. Programmatic provisioning lives in `apps/api/src/lib/voice-provider/` — `searchAvailableNumbers` + `purchaseNumber` already work on Twilio's interface; add a Telnyx adapter under `voice-provider/telnyx.ts` modeled after `voice-provider/twilio.ts`. The contract in `voice-provider/contracts.ts` is provider-neutral.

## Retell setup (one time)

1. Create a Retell account, generate an API key.
2. Create an **LLM** with the prompt in `RETELL_AGENT_PROMPT_HOME_SERVICES.md`.
3. Create an **Agent** pointing at that LLM. Set voice + latency per the doc.
4. Configure the **Webhook URL** to `https://api.skybridgecx.com/v1/retell/webhooks` and copy the **Webhook Secret** into `RETELL_WEBHOOK_SECRET`.
5. Configure **Post-call analysis** with the structured schema in the prompt doc.
6. Test from the Retell sandbox: dial in, hang up, watch the webhook fire — `apps/api/src/routes/retell-webhooks.ts` already handles `call_started`, `call_ended`, `call_analyzed`.

## Migration steps from Vercel + Render

1. Stand up the DO app in **production** mode pointed at the existing Postgres on Render (use the Render `DATABASE_URL` temporarily). Verify health.
2. Snapshot Render Postgres → restore into DO Managed Postgres. Update `DATABASE_URL`.
3. Update DNS — point `skybridgecx.com` and `app.skybridgecx.com` at DO App Platform. Vercel takes the domain off automatically when DNS flips.
4. Once green for 24h, decommission Vercel + Render projects, archive `deploy-runbook.md`.

## Cost expectations

| Line item | Monthly |
|---|---|
| DO App Platform — 2× basic-xs ($5 + $5) | $10 |
| DO Managed Postgres (1GB / 1 node) | $15 |
| Total DO | ~$25/mo |
| Telnyx — number rental | ~$1/mo per number |
| Telnyx — minutes (US local) | $0.0050–$0.0070/min |
| Retell — minutes (default voice + GPT-4o) | $0.07–$0.12/min |
| Stripe | 2.9% + 30¢ per charge |
| Clerk | Free up to 10k MAU |
| Resend | Free up to 3k emails/mo |

A $299/mo Starter plan with 500 calls × ~3 min average burns roughly $105 in Retell + $8 in Telnyx — leaves a healthy gross margin even before the smaller infra costs.
