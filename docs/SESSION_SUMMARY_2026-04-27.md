# SkyBridgeCX — Hardening + GTM Session Summary

**Date:** 2026-04-27
**Operator:** Claude (Cowork)
**Mandate:** Red-team the product, ship fixes, build a top-tier outreach agent, get ready to land paying customers.

---

## TL;DR

Three critical security holes closed, five high-severity issues fixed, the voice agent now opens with a TCPA-aware recording disclosure, the privacy policy is no longer a liability, a new conversion landing page is live at `/lp/home-services`, and there is an expert-grade outreach agent + playbook ready for Mo to run on Day 1. All TypeScript typechecks pass clean.

---

## What was wrong (and what got fixed)

The full audit lives in **[`SECURITY_AUDIT_2026-04-27.md`](./SECURITY_AUDIT_2026-04-27.md)**. Highlights:

| Sev | Finding | Status |
| --- | --- | --- |
| C1 | If both `CLERK_SECRET_KEY` and `BASIC_AUTH_*` are unset, the dashboard API serves *every* tenant endpoint with no auth. | **Fixed** — fail-closed in production (`apps/api/src/lib/basic-auth.ts`). Tests updated. |
| C2 | If `FRONTDESK_INTERNAL_API_SECRET` is unset, the realtime-gateway WebSocket accepts any connection, lets attackers burn OpenAI Realtime tokens at $0.30/min. | **Fixed** — fail-closed in `ws-auth.ts` and `twilio-media.ts`. Tests updated. |
| C3 | Tenant-configured outbound webhook URLs were SSRF-able — internal services and AWS metadata were probable through the dashboard's webhook delivery log. | **Fixed** — DNS-lookup + private-IP allowlist + `redirect: 'error'` + suspicious-hostname filter in `webhook-dispatcher.ts`. Pressure-tested by an independent reviewer; TOCTOU partially mitigated, redirect bypass closed. |
| H1 | `RETELL_WEBHOOK_SECRET=skip` bypassed signature verification in any environment. | **Fixed** — gated to non-production. |
| H2 | No call-duration cap. A silent caller could burn unbounded OpenAI tokens. | **Fixed** — hard 10-min cap (overridable via env) in realtime-gateway. Timer cleared on both `close` and `error`. |
| H3 | Stripe webhook idempotency had a check-then-record race — duplicate billing emails / clobbered tenant updates were possible. | **Fixed** — `claimWebhookEventAtomically` insert-first, throws into Stripe retry on DB blip rather than racing. |
| H4 | Tenants without a `Subscription` row got *unlimited* usage. | **Fixed** — fall back to a 25-call/mo free-tier ceiling, not infinity. |
| H5 | Privacy policy was a stub; agent never disclosed call recording. Customers were exposed to TCPA / two-party-consent claims. | **Fixed** — recording disclosure baked into EN/ES/bilingual prompts. Privacy policy rewritten with subprocessor list, retention, CCPA/GDPR rights, security contact. |
| M1 | Admin token compared with `===` (timing-attack-vulnerable). | **Fixed** — `timingSafeEqual`. |
| M2 | Twilio signature validation fell open if `NODE_ENV=development`. | **Fixed** — dev bypass now requires both NODE_ENV and an explicit opt-in env var. |
| M5 | Voice agent had no prompt-injection guardrails. | **Fixed** — guardrail block added to EN and ES prompts (refuses persona swaps, system-prompt extraction, discount-extraction, prior-caller-PII leaks). |

What's left intentionally (M3 outbound retry/backoff, M4 extended IP rate limiting, L1–L3 logging hygiene) is non-blocking for a paid pilot. Tracked in the audit doc.

### Pressure-test loop

After the first round of fixes, an independent reviewer was asked to find bypasses. Three real findings came back:

1. **C3 SSRF** had DNS TOCTOU + redirect-to-internal bypass. → Closed via `redirect: 'error'` and suspicious-hostname filter; documented residual TOCTOU as an active-attacker scenario.
2. **H3 idempotency** had a fallback race when the atomic claim *threw*. → Closed by 503-and-retry instead of falling back to a non-atomic existence check.
3. **H2 timer** wasn't cleared on socket `error`. → Cleared on both `error` and `close`.

All three follow-up patches typecheck clean.

---

## What's new for GTM

### 1. Conversion-optimized landing page — [`/lp/home-services`](../apps/web/src/app/lp/home-services/page.tsx)

A focused, single-CTA page Mo pastes into cold emails. Hero pivots on the **callable demo line** (driven by `NEXT_PUBLIC_DEMO_PHONE_NUMBER`), with pricing, FAQ, and a TCPA/recording-clean compliance trust signal. Mobile-first, no nav, no distractions. Ships through the existing Vercel pipeline with no config changes.

> **Action for Mo:** set `NEXT_PUBLIC_DEMO_PHONE_NUMBER` in your Vercel env (and a Calendly URL in `NEXT_PUBLIC_BOOKING_URL`) so the CTAs go live.

### 2. Privacy policy rewrite — [`/privacy`](../apps/web/src/app/privacy/page.tsx)

Now actually addresses what a home-services prospect's lawyer would ask: subprocessor list (Twilio, Retell, OpenAI, Stripe, Clerk, Resend), 365-day call-recording retention, CCPA/GDPR rights, DPA on request, security contact. Doubles as a **sales asset** — "TCPA-aware out of the box" is now true and provable.

### 3. Expert outreach playbook — [`docs/OUTREACH_PLAYBOOK.md`](./OUTREACH_PLAYBOOK.md)

The senior-SDR-grade source of truth: ICP filters (with both the must-hits and the disqualifiers), 100-prospect-in-90-min sourcing strategy, 14-day multi-channel cadence with full copy library (T1/T2/T3 email + LinkedIn DM + voicemail + SMS), reply-triage decision tree, full objection-handling library covering the 8 objections home-services owners actually raise, BANT-style demo flow, pipeline stage definitions with healthy-ratio benchmarks, and a weekly ops cadence.

### 4. SkyBridge outreach agent — [`agents/skybridge-outreach.md`](../agents/skybridge-outreach.md)

A Claude / Cowork subagent that reads the playbook on every run and operates against home-services SMBs. Routes itself across Apollo, Common Room, Gmail, Slack, Hubspot/Close, Clay, and Klaviyo where connected; degrades gracefully where not. Encoded behavior:

- Sourcing — applies ICP filter, demands real `trigger_note` per row, refuses generic templates.
- Sending — drafts first; only batch-sends with explicit Mo "go".
- Reply triage — Hot replies get a 5-minute response with a Calendly link; Cold and STOP get logged and suppressed.
- Demo prep — pulls Google reviews for missed-call complaints, builds a quantified loss estimate, formats for the 10-minute demo flow.
- Weekly review — compiles pipeline metrics every Friday and writes them to `docs/outreach/WEEKLY_<date>.md`.
- Hard refusal list — never invents reviews, never quotes off-list pricing, never sends from Mo's personal email without permission, never signs anything.

Install instructions in [`agents/README.md`](../agents/README.md).

> **Action for Mo:** copy `agents/skybridge-outreach.md` into your `.claude/agents/` directory (or symlink it) so the agent becomes invokable from any session in this folder.

---

## Files changed / created in this session

**Created**

- `docs/SECURITY_AUDIT_2026-04-27.md`
- `docs/OUTREACH_PLAYBOOK.md`
- `docs/SESSION_SUMMARY_2026-04-27.md` *(this file)*
- `apps/web/src/app/lp/home-services/page.tsx`
- `agents/skybridge-outreach.md`
- `agents/README.md`

**Modified — code**

- `apps/api/src/lib/basic-auth.ts` *(C1)*
- `apps/api/src/lib/admin-auth.ts` *(M1)*
- `apps/api/src/lib/twilio-validation.ts` *(M2)*
- `apps/api/src/lib/usage-limiter.ts` *(H2/H4)*
- `apps/api/src/lib/webhook-dispatcher.ts` *(C3 + follow-up)*
- `apps/api/src/routes/retell-webhooks.ts` *(H1)*
- `apps/api/src/routes/stripe-webhooks.ts` *(H3 + follow-up)*
- `apps/realtime-gateway/src/handlers/twilio-media.ts` *(C2)*
- `apps/realtime-gateway/src/index.ts` *(H2 + follow-up)*
- `apps/realtime-gateway/src/middleware/ws-auth.ts` *(C2)*
- `apps/realtime-gateway/src/services/agent-context.ts` *(M5 + H5 disclosure)*
- `apps/web/src/app/privacy/page.tsx` *(H5)*

**Modified — tests**

- `apps/api/src/lib/__tests__/basic-auth.test.ts`
- `apps/realtime-gateway/src/middleware/__tests__/ws-auth.test.ts`

**Modified — docs**

- `docs/OUTREACH_KIT.md` *(now points at the playbook + agent)*

---

## Verification

- TypeScript `tsc --noEmit` passes clean for `apps/api`, `apps/realtime-gateway`, and the new web pages (`lp/home-services`, `privacy`).
- Vitest could not be run locally because the sandbox is Linux ARM and the project's vitest depends on a macOS native binding. Run `pnpm -C apps/api test && pnpm -C apps/realtime-gateway test` on your Mac to verify the test suite. Two existing tests were updated to match the new fail-closed behavior.
- Independent second-pass review found three real follow-up issues (C3 SSRF residual, H3 fallback race, H2 timer leak) — all three patched in the same session.

---

## Mo's Day-1 checklist

1. **Run tests on your Mac:** `pnpm install && pnpm typecheck && pnpm test`. Confirm the two updated tests pass.
2. **Set production env vars** (these were the latent landmines): `CLERK_SECRET_KEY`, `FRONTDESK_INTERNAL_API_SECRET`, `RETELL_WEBHOOK_SECRET` (something other than `skip`), `STRIPE_WEBHOOK_SECRET`, `TWILIO_AUTH_TOKEN`. Make sure `NODE_ENV=production` is explicit.
3. **Set `NEXT_PUBLIC_DEMO_PHONE_NUMBER`** and `NEXT_PUBLIC_BOOKING_URL` in Vercel so the new landing page CTAs go live.
4. **Install the outreach agent**: `mkdir -p .claude/agents && cp agents/*.md .claude/agents/`.
5. **Open a session, summon the agent**: ask `skybridge-outreach` to source 30 HVAC owner-operators in Phoenix this week. Review the CSV, then ask it to draft T1.
6. **Drive 100 prospects through the cadence by Friday.** Demo day = Friday afternoon block.
7. **Update the playbook** as you learn — every objection that's not in §7 gets added.

The single number that matters: **new paying customers per week**. Everything in this session was built to move that number from 0 to ≥1 fast.
