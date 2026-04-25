# SkyBridgeCX — Launch Checklist (this week)

The single source of truth for "are we ready to charge a real customer." Walk this top-to-bottom before sending the first cold email.

Stack: **DigitalOcean App Platform + Retell + Telnyx + Postgres + Clerk + Stripe + Resend**.

---

## P0 — must be green before first paying customer

### 1. Infra is on DigitalOcean

- [ ] `do.app.yaml` committed to repo root (template in `STACK_AND_DEPLOY_DO.md`)
- [ ] `docker/web.Dockerfile` committed (template in `STACK_AND_DEPLOY_DO.md`)
- [ ] `apps/web/next.config.ts` set to `output: 'standalone'` (smaller image, faster boot)
- [ ] `doctl apps create --spec do.app.yaml` succeeded; both services healthy
- [ ] DO Managed Postgres provisioned, `DATABASE_URL` wired
- [ ] `pnpm --filter @frontdesk/db exec prisma migrate deploy` ran on first boot (post-build hook)
- [ ] `skybridgecx.com` DNS pointed at DO; SSL active
- [ ] `/healthz` on API returns 200

### 2. Stripe is real (not test placeholders)

- [ ] Live `STRIPE_SECRET_KEY` set on API
- [ ] Live `STRIPE_WEBHOOK_SECRET` set on API — **must start with `whsec_`** (the current Vercel value starts with `pk_test_` — that is wrong)
- [ ] Three live `STRIPE_PRICE_ID_*` set: STARTER, PRO, ENTERPRISE
- [ ] Live `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set on web (no `pk_test_placeholder`)
- [ ] Stripe webhook endpoint `https://api.skybridgecx.com/v1/billing/webhooks` registered, signing secret matches above
- [ ] Test charge: real card, $1, full lifecycle (checkout → portal → cancel)

### 3. Telnyx → Retell pipeline is wired

- [ ] Telnyx API key + Voice Profile + Connection ID set on API
- [ ] Retell API key + Webhook Secret set on API
- [ ] Retell webhook points to `https://api.skybridgecx.com/v1/retell/webhooks`
- [ ] **Three Retell agents created and their IDs set as env vars:**
   - `RETELL_AGENT_ID_HOME_SERVICES_EN` — prompt from `RETELL_AGENT_PROMPT_HOME_SERVICES.md`
   - `RETELL_AGENT_ID_HOME_SERVICES_ES` — prompt from `RETELL_AGENT_PROMPT_HOME_SERVICES_ES.md`
   - `RETELL_AGENT_ID_HOME_SERVICES_BILINGUAL` — prompt from `RETELL_AGENT_PROMPT_HOME_SERVICES_BILINGUAL.md` (default)
- [ ] Retell post-call analysis schema set on each agent (incl. `call_language` on the bilingual agent)
- [ ] When provisioning a Telnyx number for a tenant, route to the agent matching that tenant's `AgentProfile.language`
- [ ] Telnyx number purchased programmatically through `/v1/provisioning/purchase-number`
- [ ] Bought number's voice routing points to the Telnyx → Retell SIP connection
- [ ] Real call (English) from your cell → Sky greets in EN, captures fields, ends warmly
- [ ] Real call (Spanish) from your cell → Sky responde en español, captura los datos, despide con calidez
- [ ] Webhook fires within 30s of hang-up; prospect appears in dashboard with name/address/urgency/`call_language`
- [ ] Email lead alert lands in inbox via Resend within 60s

### 4. Onboarding self-serve works

- [ ] Sign up new test user → land on `/onboarding`, dark theme renders correctly
- [ ] Step 1 Business Info save returns 200; field saved in DB
- [ ] Step 2 Greeting save returns 200; visible in agent profile
- [ ] Step 3 Phone Number search → purchase succeeds end-to-end on Telnyx
- [ ] Step 4 Completion finalizes; redirects to `/dashboard` (or `/billing` if no sub)
- [ ] Skipping the wizard works and routes to billing

### 5. Billing self-serve works

- [ ] `/billing` renders the three plans correctly
- [ ] "Subscribe" hits `create-checkout-session`, redirects to Stripe Checkout
- [ ] Checkout success returns to `/billing?checkout=success` with active sub
- [ ] "Manage subscription" opens Stripe Portal
- [ ] Subscription status badge updates after webhook (active / trialing / past_due)
- [ ] `subscription-guard.ts` blocks dashboard access for non-subscribers and redirects to `/billing?notice=subscription-required`

### 6. Observability

- [ ] Sentry SDK installed in `apps/web` and `apps/api`
- [ ] `SENTRY_DSN` set on both DO services
- [ ] Trigger a test error → confirm it lands in Sentry
- [ ] DO App Platform "Activity" tab piped to a Slack channel for deploy + crash alerts
- [ ] Uptime monitor (BetterStack free or DO's built-in) hitting `/healthz` every minute

### 7. Legal + content

- [ ] `/privacy` reviewed for data-collection language (call recordings, transcripts, Stripe, Clerk, Telnyx)
- [ ] `/terms` reviewed; payment + auto-renew + cancellation language present
- [ ] Footer email `hello@skybridgecx.com` is real and forwards to your inbox

## P1 — should ship this week, not blocking first dollar

- [ ] One- or two-minute demo video recorded on the live number, embedded on landing page (replace "See How It Works" link)
- [ ] Replace fake testimonials in `apps/web/src/app/page.tsx` with at least one real quote (free pilot user is fine — see Outreach Kit)
- [ ] Booking link (Cal.com or Calendly) for "Book a Demo" CTA — currently `/sign-up`
- [ ] Knowledge base page (`/help`) covering: porting numbers, after-hours rules, customizing greeting, escalation, exporting prospects
- [ ] Slack `#prod-alerts` channel for Sentry + Stripe failure events

## P2 — soon-but-not-now

- [ ] CRM integrations (HubSpot, Jobber, Housecall Pro) — top contractor PM tools
- [ ] SMS lead alerts via Telnyx Messaging Profile
- [ ] Multi-business switcher in the dashboard
- [ ] White-label / agency tier (multi-tenant of a tenant)
- [ ] Additional language variants (Portuguese, Vietnamese, Mandarin) — Spanish + bilingual already shipped in P0

## End-to-end smoke test (run before sending the first cold email)

1. Open browser incognito → `https://skybridgecx.com`
2. Click "Start Free Trial" → sign up with a fresh email
3. Complete onboarding (Business Info → Greeting → Phone Number → Done). Verify Telnyx number appears.
4. Hit "Continue to Billing" → subscribe to **Starter** with a real card.
5. Open dashboard. Confirm subscription status badge says **Trialing** or **Active**.
6. Pick up your phone, call your new SkyBridgeCX number.
7. Pretend to be a homeowner with a leaking water heater. Provide name + address.
8. Hang up. Within 60s:
   - [ ] Email alert in inbox (subject "New lead — name — emergency")
   - [ ] Prospect record visible in `/prospects` with all fields
   - [ ] Call record visible in `/calls` with transcript + recording playback
9. Cancel via Stripe Portal. Confirm dashboard reflects `cancel_at_period_end`.
10. If all 9 steps green → you are clear to sell.
