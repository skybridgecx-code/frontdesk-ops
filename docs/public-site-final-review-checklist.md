# Public Site Final Review Checklist

## Branch

- `codex/moleads-public-site-and-prospect-engine`

## Review Order

1. Open `apps/web/src/app/page.tsx`
2. Open `apps/web/src/app/services/page.tsx`
3. Open `apps/web/src/app/contact/page.tsx`
4. Open `apps/web/src/app/layout.tsx`
5. Open `README.md`
6. Open `docs/public-site-handoff.md`
7. Open `docs/public-site-merge-summary.md`
8. Open `docs/public-site-pr-summary.md`
9. Open `docs/public-site-review-scope.md`

## Verify Homepage

- Hero states the AI frontdesk offer clearly
- Proof section reinforces:
  - inbound calls or requests are captured
  - first-pass intake or routing stays visible
  - operators can review and follow up
- `#how-it-works` follows the same sequence
- Closing CTA asks for intake review

## Verify Services Page

- Hero uses the same intake-story language
- Service buckets scan in this order:
  - capture inbound demand
  - organize first-pass intake
  - keep operator follow-up visible
- Supporting proof stays product-true
- Closing CTA asks for intake review or help with intake/follow-up

## Verify Contact Page

- Page frames the form as business intake, not generic contact
- Supporting copy scans in this order:
  - request comes in
  - intake keeps details visible
  - operators follow up
- Form-facing reassurance stays grounded in visible intake and actionable follow-up

## Verify README And Docs

- `README.md` points to `docs/public-site-handoff.md`
- `docs/public-site-handoff.md` explains branch context and bounded-phase workflow
- `docs/public-site-merge-summary.md` explains merge scope and reviewer checklist
- `docs/public-site-pr-summary.md` is ready to paste into a PR
- `docs/public-site-review-scope.md` isolates the public-site review slice from earlier branch work

## Preserved Behavior

- No backend, schema, or operator-flow changes in the public-site slice
- No public-form payload, validation, or submit-behavior changes
- No speculative claims, fake proof, pricing, or analytics additions

## Validation Commands

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

## Final Reviewer Action

1. Approve or request changes on the public-site slice first
2. Then, only if needed, inspect the earlier non-public-site branch work separately
