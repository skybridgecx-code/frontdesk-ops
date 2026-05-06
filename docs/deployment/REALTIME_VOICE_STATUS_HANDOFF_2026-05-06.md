# Realtime Voice Status Handoff (2026-05-06)

## Scope
This note is the operator handoff point to pause OpenAI billing/credits work without losing deployment and routing context.

## Environment
1. Twilio number: `+1 202 935 9687`
2. API app URL: `https://monkfish-app-hmt75.ondigitalocean.app`
3. Realtime gateway URL: `https://frontdesk-realtime-gateway-fdk6s.ondigitalocean.app`

## Current Confirmed Working Path
1. Twilio inbound reaches API.
2. Phone number maps in DB.
3. Routing mode is `AI_ALWAYS`.
4. API returns TwiML stream to realtime gateway.
5. Realtime gateway receives Twilio media.
6. Realtime gateway opens OpenAI realtime websocket.
7. `session.update` is sent.
8. Initial `response.create` is sent.

## Current Blocker
1. OpenAI returns `insufficient_quota`.
2. This is billing/credits/quota, not app routing.

## Exact Success/Error Logs Already Observed
1. `openai.initial_greeting.response_create.sent`
2. `openai realtime error event insufficient_quota`

## Next Test After Credits Are Added
1. Call `+1 202 935 9687`.
2. Expect log: `openai.output_audio.delta received`
3. Expect log: `twilio outbound media sent`

## Operator Dashboard Surface
1. The tenant dashboard now includes a **Realtime Voice Status** card under **Phone + voice readiness**.
2. It explicitly marks Twilio/DB/routing/realtime path as confirmed.
3. It explicitly marks OpenAI quota/billing credits as the active blocker.
4. It includes the operator checklist for post-credit verification.

## Exact Log Command To Rerun After Credits Fix
```bash
cd "/Users/muhammadaatif/frontdesk-os"
RT_APP_ID="0e5eb264-cf8b-4db4-83d5-8d00ae3f864c"
RT_DEPLOY_ID="$(doctl apps list-deployments "$RT_APP_ID" --format ID --no-header | head -1 | tr -d '[:space:]')"
doctl apps logs "$RT_APP_ID" realtime-gateway --deployment "$RT_DEPLOY_ID" --type run --tail 300 | egrep -i "openai realtime websocket opened|openai session.update sent|openai.initial_greeting.response_create.sent|openai.output_audio.delta received|twilio outbound media sent|insufficient_quota"
```
