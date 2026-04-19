# Retell + Telnyx Migration Scope Lock

## Objective

Migrate live voice from Twilio + custom realtime gateway to Retell + Telnyx
without breaking the existing app, dashboard, or call-review workflow.

This document is a scope lock only. It does not perform production cutover.

---

## What stays

These remain source-of-truth application surfaces and should be preserved:

- `Call` / `CallEvent` data model as the operator-facing system of record
- `/v1/calls` list contract used by dashboard call log / queue
- `/v1/calls/:callSid` detail contract used by dashboard call detail
- existing dashboard call pages and review flows
- Clerk auth
- Stripe billing
- Resend email
- current call triage/review/operator workflow
- missed-call / text-back evidence model already surfaced in UI

### Compatibility rule

The migration must preserve enough of the current call/event contract so that:
- call list keeps rendering
- call detail keeps rendering
- voice evidence still appears in operator UI
- existing review flows do not require a dashboard rewrite during provider cutover

---

## What gets replaced

These are provider-specific voice path components that should be migrated away from:

- Twilio inbound AI voice entrypoint in `apps/api/src/routes/voice-webhooks.ts`
- Twilio status callback ingestion in `apps/api/src/routes/voice-status-webhooks.ts`
- custom realtime voice gateway in `apps/realtime-gateway/*`
- Twilio media stream handoff and auth path
- direct Twilio/OpenAI live audio bridge as the primary production voice path

### Target replacement

- Retell = live voice agent runtime
- Telnyx = telephony / SIP
- app API = provider-neutral call ingestion + business workflow + operator surfaces

---

## Current UI/data contract to preserve

### Call list

`/v1/calls` currently returns call records with compact `voiceHandling` summary:
- `fallbackUsed`
- `textBackOutcome`
- `textBackSkippedReason`

### Call detail

`/v1/calls/:callSid` currently returns a call record plus `events`,
and dashboard detail renders:
- inbound fallback evidence
- missed-call text-back evidence
- latest Twilio status evidence

### Migration requirement

During migration, provider-specific events may change internally,
but the API returned to the dashboard must remain compatible.

Preferred approach:
- translate provider-specific Retell/Telnyx lifecycle into current normalized event vocabulary
- preserve current UI payload shape during transition

---

## Current provider-specific replacement targets

### Replace
- `apps/api/src/routes/voice-webhooks.ts`
- `apps/api/src/routes/voice-status-webhooks.ts`
- `apps/realtime-gateway/src/index.ts`
- `apps/realtime-gateway/src/handlers/twilio-media.ts`
- related realtime gateway services / middleware / tests

### Review and classify
- `apps/api/src/routes/twilio-voice.ts`

`twilio-voice.ts` is currently still registered in API startup and should be treated
as a live legacy TwiML/voicemail-style flow until proven otherwise.

In code, this path is explicitly isolated as
`registerLiveLegacyTwilioVoiceRoutes` in `apps/api/src/server.ts`.
This is naming/classification only; runtime behavior remains unchanged.

Before production cutover, it must be explicitly classified as one of:
1. legacy path to retire
2. temporary fallback path to preserve
3. still-active path that needs a separate Retell/Telnyx replacement plan

No silent assumptions.

---

## Provider-neutral target architecture

### New voice path
- Telnyx number / SIP trunk
- Retell agent
- Retell webhooks/tools into app API
- app persists normalized call lifecycle into existing `Call` / `CallEvent` model
- dashboard continues reading from existing app API

### App responsibilities after migration
- persist inbound call records
- persist call status changes
- persist transcript / summary / extracted fields
- persist missed-call / fallback / follow-up evidence
- expose stable operator-facing APIs

### Retell responsibilities after migration
- live conversation runtime
- speech turn-taking
- agent execution
- transcript / summary / structured call outputs

### Telnyx responsibilities after migration
- numbers
- inbound/outbound telephony
- SIP connectivity into Retell

---

## Rollout phases

### Phase 0
Scope lock and provider-boundary documentation.

### Phase 1
Introduce provider-neutral ingestion boundary in API.

### Phase 2
Stand up Retell + Telnyx sandbox in parallel with existing Twilio path.

### Phase 3
Map Retell lifecycle events into existing `Call` / `CallEvent` model and verify dashboard compatibility.

### Phase 4
Production cutover to Retell + Telnyx.

### Phase 5
Remove custom realtime gateway and obsolete Twilio AI voice path after stable soak.

---

## Rollback plan

If Retell/Telnyx cutover fails:

1. stop new migration changes
2. switch number routing back to prior production voice path
3. keep dashboard/API contracts unchanged
4. preserve call data already written during migration tests
5. rollback only provider ingress, not operator-facing schema or dashboard contracts

---

## Explicit non-goals for this phase

- no production provider cutover
- no dashboard rewrite
- no schema redesign
- no billing/auth changes
- no speculative multi-provider orchestration
- no removal of legacy code yet

---

## Exit criteria for scope lock

This phase is complete when:
- migration boundary is documented
- replacement targets are named
- keep-vs-replace decision is explicit
- legacy `twilio-voice.ts` is explicitly called out for classification in the next phase
- no production behavior changes have been made
