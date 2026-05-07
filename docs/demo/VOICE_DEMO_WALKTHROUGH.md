# Frontdesk OS Voice Demo Walkthrough

## Purpose
Use this 5-minute walkthrough to demo the current Frontdesk OS voice system safely and accurately while OpenAI credits are still blocked.

## Local Demo Data Seed (skybridge-demo)
Run this before the walkthrough if local dashboard data looks empty:

```bash
pnpm --filter @frontdesk/db seed:skybridge-demo
```

Notes:
- This seed path only targets tenant slug `skybridge-demo`.
- It writes fake home-services demo calls and prospects with idempotent upserts.
- It does not seed real customer PII.

## Current State (Say This Clearly)
- Live routing is working end-to-end through OpenAI `response.create`.
- The current blocker is OpenAI API quota/credits (`insufficient_quota`), not Twilio, DigitalOcean, DB mapping, or stream routing.
- Voice Simulation Mode exists so you can present the voice flow safely without claiming live caller audio output.
- Do not state that callers can currently hear AI until credits are restored and outbound audio logs are verified.

## 5-Minute Demo Script
1. `0:00-0:30` Open with business outcome:
   - "For home services teams, this system answers inbound calls, captures lead context, and routes follow-up without dropping opportunities."
2. `0:30-1:30` Open dashboard:
   - Show the operator command center and position it as the control surface for call operations.
3. `1:30-2:30` Show **Realtime Voice Status**:
   - Call out confirmed signals: Twilio inbound, number mapping, `AI_ALWAYS`, realtime gateway connected, OpenAI `response.create` reached.
   - Call out blocker: OpenAI quota/credits.
4. `2:30-3:45` Show **Voice Simulation Mode**:
   - Explain it is a demo-safe representation of the same verified path.
   - Walk through each simulated step and end at the explicit quota blocker.
5. `3:45-5:00` Close with verification plan:
   - "As soon as credits are added, we run one live call and verify outbound AI audio events in logs."

## Step-by-Step Demo Flow
1. Open dashboard (`/dashboard`).
2. Open **Phone + voice readiness** panel.
3. Show **Realtime Voice Status** card.
4. Show **Voice Simulation Mode** card (`Demo mode`).
5. Explain confirmed call path:
   - inbound call received
   - phone number matched
   - routing mode `AI_ALWAYS`
   - realtime gateway connected
   - OpenAI `response.create` reached
6. Explain blocker and next step:
   - blocker: OpenAI API quota/credits
   - next expected events after credits: `openai.output_audio.delta received`, `twilio outbound media sent`

## Buyer-Facing Wording (Home Services)
- "This gives your office a 24/7 AI front desk so missed calls do not become lost jobs."
- "The system already routes real inbound calls and reaches live AI response creation."
- "Today’s blocker is billing quota at the AI provider, not your phone setup or call routing."
- "We use simulation mode to demo the operating flow safely until credits are turned back on."

## Operator Checklist Before a Real Demo
- Confirm dashboard loads and shows both cards:
  - **Realtime Voice Status**
  - **Voice Simulation Mode**
- Confirm blocker text still states OpenAI quota/credits.
- Confirm no secrets are visible in UI or notes.
- Align talk track to "routing works, audio blocked by quota."
- Do not claim audible caller AI until post-credit logs confirm it.

## Post-Credit Live Test Checklist
1. Call `+1 202 935 9687`.
2. Confirm log: `openai.output_audio.delta received`.
3. Confirm log: `twilio outbound media sent`.
