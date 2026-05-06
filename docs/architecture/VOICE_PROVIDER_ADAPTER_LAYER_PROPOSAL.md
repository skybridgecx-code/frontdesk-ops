# Voice Provider Adapter Layer Proposal

## Objective
Design a provider fallback architecture for frontdesk-os voice agents without replacing the current `openai_realtime` runtime path.

## Current Provider
1. `openai_realtime` (primary, current production path)

## Candidate Fallback Providers
1. `twilio_conversationrelay`
2. `retell`
3. `deepgram_voice_agent`
4. `gemini_live`

## Proposed Architecture
Use a provider adapter layer with one common contract and provider-specific implementations. Keep routing, event persistence, and operator surfaces provider-neutral.

High-level components:
1. `ProviderRegistry`
2. `VoiceProviderAdapter` implementations (one per provider)
3. `CallOrchestrator` (selection, failover, retries, fallback messaging)
4. Existing persistence/event pipeline (unchanged shape, provider-prefixed event typing)

## Common Provider Contract
Each provider adapter should implement a shared contract with these operations:

1. `answerInboundCall(context)`
Purpose: initialize provider-side call/session resources when inbound call is accepted.

2. `streamCallerAudio(frame, context)`
Purpose: accept caller audio frames from Twilio/media ingress and forward to provider.

3. `generateAndSpeakFirstGreeting(context)`
Purpose: issue first assistant response without waiting for caller speech.

4. `receiveTranscript(event, context)`
Purpose: normalize inbound transcript deltas/completions to common transcript events.

5. `sendOutboundResponse(payload, context)`
Purpose: send provider output back to caller (audio stream and/or text response abstraction).

6. `emitCallEvent(event, context)`
Purpose: emit normalized lifecycle events (`provider.status.*`, `provider.response.*`, etc.).

7. `reportProviderError(error, context)`
Purpose: classify and normalize provider errors into operator-safe codes.

## Failover Behavior
### Error classification
When `openai_realtime` returns quota/billing failure:
1. set `provider_error=insufficient_quota`
2. mark call/provider state with normalized error metadata
3. emit provider-prefixed error event for operator visibility

### Operator-safe fallback behavior
1. show operator-safe fallback message (no secrets, no raw payloads)
2. keep call routing diagnosis explicit: provider quota failure vs app routing failure

### Optional alternate-provider routing
If configured for the tenant/number:
1. attempt failover to alternate provider (`twilio_conversationrelay` / `retell` / `deepgram_voice_agent` / `gemini_live`)
2. preserve call correlation IDs and provider transition event trail
3. avoid infinite loops (single failover attempt per call by default)

If no alternate provider is configured:
1. degrade gracefully with fallback message and clear operator event

## Demo Modes
1. **Real OpenAI Realtime**
Primary live mode using `openai_realtime` adapter.

2. **Retell managed demo**
Managed demo path using `retell` adapter while preserving common event contract.

3. **Twilio ConversationRelay demo**
Demo path using `twilio_conversationrelay` adapter.

4. **Local transcript-only simulation**
No live voice synthesis; simulate transcripts and response lifecycle for local/operator validation.

## Migration Plan (Phased)
### Phase 0: Contract Finalization
Scope:
1. Define `VoiceProviderAdapter` interface and normalized error/event schema.
2. Define provider capability matrix (audio out, transcript source, greeting strategy, failover support).

Acceptance criteria:
1. Contract compiles with `openai_realtime` adapter stubbed against interface.
2. No behavior change in current production runtime.

### Phase 1: Wrap Existing OpenAI Realtime Path
Scope:
1. Implement `openai_realtime` adapter on top of current realtime gateway flow.
2. Route existing lifecycle through adapter contract with no functional regression.

Acceptance criteria:
1. Existing realtime tests/build pass unchanged or with additive assertions.
2. Greeting, audio append, response, and stop flows behave exactly as current.

### Phase 2: Provider Selection + Error Normalization
Scope:
1. Add `ProviderRegistry` + per-call provider resolution.
2. Normalize provider errors (including `insufficient_quota`).
3. Add operator-facing provider status/error fields.

Acceptance criteria:
1. `insufficient_quota` is surfaced as `provider_error=insufficient_quota`.
2. Operator can distinguish provider failure from routing/infrastructure failure.

### Phase 3: Add Fallback Provider Adapters (Demo-first)
Scope:
1. Add adapter implementations incrementally:
   - `retell`
   - `twilio_conversationrelay`
   - `deepgram_voice_agent`
   - `gemini_live`
2. Keep each behind explicit feature flags/config.

Acceptance criteria:
1. Each adapter passes contract tests for greeting, transcripts, events, and error mapping.
2. Primary OpenAI path remains default and unchanged unless configured otherwise.

### Phase 4: Controlled Failover
Scope:
1. Add optional failover orchestration from primary to alternate provider.
2. Add guardrails: max one failover per call, full provider transition logging.

Acceptance criteria:
1. Forced OpenAI quota failure triggers configured fallback (or graceful fallback message).
2. Event stream clearly shows provider transition and resulting call outcome.

### Phase 5: Operator Runbook and Rollout
Scope:
1. Add deployment/ops runbook for provider mode switches and rollback.
2. Add dashboard annotations for active provider + fallback reason.

Acceptance criteria:
1. On-call/operator can safely enable/disable provider fallback without code changes.
2. Rollback to OpenAI-only mode is one config change and verified in smoke tests.

## Non-Goals (This Proposal)
1. No provider runtime implementation changes in this doc.
2. No secrets or credential material.
3. No replacement of current OpenAI Realtime path at this stage.
