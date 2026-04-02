# Public Site Merge Summary

## Branch

- `codex/moleads-public-site-and-prospect-engine`

## Purpose

This branch tightened the public site so it tells one product-true story:

1. inbound calls and public requests are captured
2. first-pass intake and routing stay visible
3. operators can review what happened and follow up
4. follow-up work stays actionable until handled

This summary is for merge and review. The detailed handoff artifact remains [`docs/public-site-handoff.md`](./public-site-handoff.md).

## Public Routes Touched

Public-site routes changed on this branch:

- `/` via `apps/web/src/app/page.tsx`
- `/contact` via `apps/web/src/app/contact/page.tsx`
- `/services` via `apps/web/src/app/services/page.tsx`
- shared public metadata via `apps/web/src/app/layout.tsx`

Supporting public-site docs changed on this branch:

- `README.md`
- `docs/public-site-handoff.md`
- `docs/public-site-merge-summary.md`

## Completed Public-Site Phases

Committed public-site phases on this branch:

- `123df03` — Tighten homepage clarity and CTA structure
- `b40597c` — Add homepage workflow walkthrough and operational proof
- `ae91707` — Clarify contact page intake flow and next steps
- `fc1960a` — Clarify services page offer and workflow proof
- `69261d2` — Tighten public lead form trust copy and success states
- `a0d072e` — Align public site CTAs with intake workflow
- `dce7315` — Align public site metadata with intake workflow
- `cf0f03b` — Clarify homepage hero for AI frontdesk intake
- `a21daa3` — Tighten homepage operational proof hierarchy
- `98bb8fe` — Clarify homepage closing CTA for intake review
- `42637f1` — Tighten services page workflow hierarchy
- `1eb140c` — Tighten contact page intake workflow clarity
- `350ac4a` — Tighten homepage workflow walkthrough clarity
- `81f8db9` — Clarify services page closing CTA for intake review
- `92d2784` — Clarify services page hero for intake workflow
- `e9c17f2` — Add public site handoff document
- `1f52745` — Add README pointer to public site handoff

## Public-Site File Scope

Primary public-site app files:

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/contact/page.tsx`
- `apps/web/src/app/services/page.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/home-lead-payload.ts`
- `apps/web/src/app/home-lead-notification.ts`

Public-site docs:

- `README.md`
- `docs/public-site-handoff.md`
- `docs/public-site-merge-summary.md`

Note:

- `git diff --name-only main...HEAD` includes many non-public-site files because this branch also contains operator, routing, domain, and validation work. Review the public-site copy work separately from the broader branch.

## Preserved Constraints

This public-site work intentionally did **not** change:

- backend routes or API contracts
- schema or Prisma models
- operator queue/detail runtime behavior
- public lead form field set
- form payload shape
- validation rules
- submit actions
- success and failure control flow

This public-site work also intentionally avoided:

- speculative product claims
- fake proof, metrics, or testimonials
- pricing changes
- analytics additions
- new public pages

## Reviewer Checklist

Review in this order:

1. Homepage
   - open `/`
   - confirm the hero states the AI frontdesk offer clearly
   - confirm `#how-it-works` reads in the capture -> intake -> review/follow-up sequence
   - confirm proof and closing CTA use the same intake-story language
2. Services
   - open `/services`
   - confirm the hero, service buckets, inspectable-workflow section, and closing CTA follow the same sequence
3. Contact
   - open `/contact`
   - confirm the page frames the form as business intake, not generic contact
   - confirm the reassurance copy explains request -> intake visibility -> operator follow-up
4. Docs
   - confirm `README.md` points to `docs/public-site-handoff.md`
   - confirm `docs/public-site-handoff.md` and this doc are enough for next-chat or reviewer orientation

## Validation Commands

Run exactly:

```bash
cd "/Users/muhammadaatif/frontdesk-os"
git checkout codex/moleads-public-site-and-prospect-engine
pnpm --filter @frontdesk/api test
pnpm --filter @frontdesk/api build
pnpm --filter web test
pnpm --filter web build
pnpm --filter @frontdesk/realtime-gateway build
pnpm validate:local-operator
git status -sb
```

Expected validation shape:

- API tests pass
- API build passes
- web tests pass
- web build passes
- realtime-gateway build passes
- `validate:local-operator` passes with the bounded smoke baseline:
  - `reviewNext = CA_DEMO_101`
  - `prospectReviewNext = PR_DEMO_101`
  - call queue first two = `CA_DEMO_101`, `CA_DEMO_102`
  - prospect queue first two = `PR_DEMO_101`, `PR_DEMO_102`

## Current Status

Current merge-readiness status:

- public-site copy work is summarized and documented
- handoff and reviewer entry points now exist
- branch still contains broader non-public-site work in addition to public-site work

## Suggested Next Action

Best next step:

1. review the public-site surfaces using the checklist above
2. validate with the command block above
3. if accepted, proceed to PR review using this doc plus [`docs/public-site-handoff.md`](./public-site-handoff.md)
