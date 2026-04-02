# Public Site Review Scope Audit

## Branch

- `codex/moleads-public-site-and-prospect-engine`

## Intended Review Scope

This review slice is the public-site work on the branch, not the full branch diff.

Review this scope as a messaging and docs pass for the public site:

1. homepage copy and CTA clarity
2. services-page copy hierarchy and CTA clarity
3. contact-page intake framing
4. shared public-site metadata and repeated CTA consistency
5. public-site reviewer docs

Do not treat the broader branch history as one public-site-only change. This branch also contains earlier API, domain, db, realtime, operator, and workflow work that predates the public-site refinement sequence.

## Exact Routes / Pages In Scope

Public routes/pages to inspect first:

- `/` via `apps/web/src/app/page.tsx`
- `/contact` via `apps/web/src/app/contact/page.tsx`
- `/services` via `apps/web/src/app/services/page.tsx`
- shared public metadata via `apps/web/src/app/layout.tsx`

## Exact Docs In Scope

Reviewer docs in scope:

- `README.md`
- `docs/public-site-handoff.md`
- `docs/public-site-merge-summary.md`
- `docs/public-site-pr-summary.md`
- `docs/public-site-review-scope.md`

## Public-Site Commits In Scope

These commits are the intended public-site review slice:

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
- `ee15979` — Add public site merge readiness summary
- `7b4e79c` — Add public site PR summary

## Earlier Branch Commits Present But Not The Focus Of This Review

These earlier commits exist on the branch, but they are not the intended focus of this public-site review:

- `fe1b097` — Persist and surface inbound routing decisions for operators
- `dee7b99` — Add normalized operator timelines to call and prospect detail
- `441b5cc` — Add deterministic last-activity previews to operator queues
- `bf5f449` — Persist local operator drafts on detail forms
- `062d0c9` — Add deterministic queue-level action hints for operators
- `fbc2333` — Unify operator mutation workflow semantics across detail pages
- `6d8d4a8` — Unify call and prospect detail pages with shared operator shell
- `68b1abb` — Add deterministic operator action guide for outbound prospects
- `0dd7f7b` — Add deterministic operator action guide for inbound calls
- `7cca64c` — Extract inbound routing policy for frontdesk voice calls
- `ebbe8c8` — Build business-aware AI session context for frontdesk calls
- `0660619` — Decompose realtime gateway into bounded modules
- `0fce27c` — Resolve active workspace without hardcoded bootstrap scope
- `5e346b6` — Add operator workspace home for inbound and outbound queues
- `7120eb8` — Harden prospect workflow and pilot readiness
- `920e3b3` — Build MoLeads public site and prospect workflow

## Exact Files A Reviewer Should Inspect First

Start with these files:

1. `apps/web/src/app/page.tsx`
2. `apps/web/src/app/services/page.tsx`
3. `apps/web/src/app/contact/page.tsx`
4. `apps/web/src/app/layout.tsx`
5. `README.md`
6. `docs/public-site-handoff.md`
7. `docs/public-site-merge-summary.md`
8. `docs/public-site-pr-summary.md`
9. `docs/public-site-review-scope.md`

Use `git diff --name-only main...HEAD` or `git diff --name-only origin/main...HEAD` only as branch context. Those diffs include broader non-public-site work and should not define the public-site review scope by themselves.

## Reviewer Instruction

Recommended review order:

1. review the public-site copy and docs changes first
2. validate the public routes and docs against the public-site messaging rules
3. only after that, optionally inspect earlier branch work separately as a different review concern

Public-site messaging should remain inside these product-truth rules:

1. inbound calls and public requests are captured
2. first-pass intake and routing stay visible
3. operators can review what happened and follow up
4. follow-up work stays actionable until handled

## Exact Validation Commands

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

Validation target:

- API tests pass
- API build passes
- web tests pass
- web build passes
- realtime-gateway build passes
- `validate:local-operator` passes with the established smoke baseline

## Current Status

Current repo-truth status for this review slice:

- public-site review scope is documented separately from the broader branch
- reviewer entry docs now include handoff, merge summary, PR summary, and this scope audit
- next action is to review the public-site surfaces intentionally, then decide whether to examine the earlier non-public-site branch work as a separate pass
