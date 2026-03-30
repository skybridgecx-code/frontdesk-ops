# Public Site Branch Handoff

## Branch

- `codex/moleads-public-site-and-prospect-engine`

## Public-Site Goal

Keep the public site honest and easy to scan:

1. explain the offer as an AI frontdesk for service-business intake and follow-up
2. show the workflow in practical terms
3. point visitors into the intake request flow
4. avoid claims the product cannot defend in repo truth

## Operating Model

Use this branch with a strict bounded-phase workflow:

1. one bounded phase at a time
2. Codex executes the phase directly
3. validate with repo truth, not memory
4. commit only after validation is green and the diff matches the phase
5. no scope drift

This branch has been run with an architect-review pattern:

- Codex implements only the requested slice
- reviewer checks the actual repo diff and page truth
- if the claimed change is missing, treat the phase as incomplete
- if a phase is a no-op because the target surface does not exist, close it as a no-op and document why

## Completed Public-Site Commits

Committed public-site work already on this branch:

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

Related branch work that supports public-site truth but is not public-site copy work:

- `fe1b097` — Persist and surface inbound routing decisions for operators
- `dee7b99` — Add normalized operator timelines to call and prospect detail
- `441b5cc` — Add deterministic last-activity previews to operator queues
- `bf5f449` — Persist local operator drafts on detail forms

## Current Messaging Rules

Public-site language on this branch should stay inside these product-truth rules:

1. inbound calls and public requests are captured
2. first-pass intake and routing stay visible
3. operators can review what happened and follow up
4. follow-up work stays actionable until handled

What to avoid:

- fake metrics
- customer logos or testimonials that are not real
- pricing claims not implemented in repo truth
- CRM-replacement claims
- speculative automation claims
- analytics-heavy positioning

Short version:

- honest wedge: stop inbound demand from disappearing between first contact and follow-up

## Validation Workflow

Standard handoff validation block:

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

Notes:

- `pnpm validate:local-operator` expects the local API to be reachable at `http://127.0.0.1:4000`
- use [`docs/local-operator-validation.md`](./local-operator-validation.md) for the fuller local runbook
- use [`docs/pilot-runbook.md`](./pilot-runbook.md) for the manual pilot/demo narrative

## Current Status

Current public-site structure in repo truth:

- homepage carries the core offer, workflow walkthrough, proof, and closing CTA
- `/contact` frames the form as business intake and explains what happens next
- `/services` explains the offer in the same capture -> intake -> follow-up order
- there is no shared public footer or bottom-of-shell support copy in `apps/web/src/app/layout.tsx`

That last point matters for future review:

- a prior bounded phase targeting shared public footer copy was correctly closed as a no-op because no shared footer exists in the current app structure

## Future Candidates

These are candidate categories for future bounded phases. They are not completed work:

1. tighten repeated public-nav microcopy if any new CTA drift appears
2. add a real shared public footer only if the product team explicitly wants that surface to exist
3. audit page-to-page duplication in public lead-form framing if a shared public form component is introduced later
4. improve public-site screenshots or visual proof only if they can be sourced from real product surfaces
5. review mobile scanability of the public site as a separate bounded UX pass

## Next-Chat Continuation Model

For the next chat or reviewer:

1. inspect repo truth first
2. confirm the requested surface actually exists
3. keep the phase bounded to one page or one shared surface
4. make the smallest defensible diff
5. run the standard validation block
6. report exact `git status -sb`
7. do not commit until the reviewer accepts the phase
