# Production Voice Smoke Note (2026-04-18)

## Scope validated

- Production API: `https://frontdesk-ops.onrender.com`
- Production realtime WS: `wss://frontdesk-realtime.onrender.com/ws/media-stream`
- Number attachment verified:
  - `+12029359687`
  - `tenantId=cmnwbau4b000pdq1wzpsuu030`
  - `businessId=cmnwbau4t000rdq1wy51de728`
- Deployed voice-path commits in production:
  - `97b9025` (`fix(realtime): authenticate Twilio media stream from signed start parameters`)
  - `176c983` (`tune(realtime): reduce voice interruptions and enforce concise turn-taking`)

## Observed failure (transient)

- One production call failed before TwiML/stream start with Twilio `502` timeout on:
  - `/v1/twilio/voice/inbound`
  - `/v1/twilio/voice/status`
- This was treated as operational API availability/cold-start behavior on `frontdesk-ops`, not a proven realtime code-path regression.

## Successful retest proof

- `has_media_start=true`
- `has_openai_ws=true`
- `has_openai_audio_out=true`
- `auth_source=custom`

## Follow-up

- Rotate `FRONTDESK_INTERNAL_API_SECRET` off placeholder value in production.
