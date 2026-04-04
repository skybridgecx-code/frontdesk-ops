#!/usr/bin/env bash
set -euo pipefail

# Production smoke test for Frontdesk Ops.
# Required env vars:
#   WEB_URL   e.g. https://frontdesk-ops-web.vercel.app
#   API_URL   e.g. https://frontdesk-ops.onrender.com
#   OPS_USER  basic auth username
#   OPS_PASS  basic auth password
#
# Optional env vars:
#   TWILIO_TO_E164   defaults to the demo bootstrap phone number (+17035550100)
#   TWILIO_FROM_E164 defaults to +17035550199
#   TWILIO_CALL_SID  defaults to a deterministic demo sid-like value

: "${WEB_URL:?WEB_URL is required}"
: "${API_URL:?API_URL is required}"
: "${OPS_USER:?OPS_USER is required}"
: "${OPS_PASS:?OPS_PASS is required}"

TWILIO_TO_E164="${TWILIO_TO_E164:-+17035550100}"
TWILIO_FROM_E164="${TWILIO_FROM_E164:-+17035550199}"
TWILIO_CALL_SID="${TWILIO_CALL_SID:-CA_PROD_SMOKE_001}"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

print_section() {
  printf '\n== %s ==\n' "$1"
}

check_status() {
  local label="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" != "$expected" ]]; then
    printf 'FAIL: %s expected HTTP %s, got %s\n' "$label" "$expected" "$actual" >&2
    exit 1
  fi

  printf 'PASS: %s returned HTTP %s\n' "$label" "$actual"
}

contains_or_fail() {
  local label="$1"
  local needle="$2"
  local file="$3"

  if ! grep -q "$needle" "$file"; then
    printf 'FAIL: %s missing expected content: %s\n' "$label" "$needle" >&2
    printf 'Response body follows:\n' >&2
    sed -n '1,120p' "$file" >&2
    exit 1
  fi

  printf 'PASS: %s contains %s\n' "$label" "$needle"
}

json_get() {
  local expr="$1"
  local file="$2"

  node -e '
const fs = require("node:fs");
const expr = process.argv[1];
const file = process.argv[2];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const value = eval(expr);
if (value === undefined) {
  process.exit(1);
}
if (value === null) {
  process.stdout.write("null");
} else if (typeof value === "string") {
  process.stdout.write(value);
} else {
  process.stdout.write(JSON.stringify(value));
}
' "$expr" "$file"
}

assert_json_path() {
  local label="$1"
  local expr="$2"
  local file="$3"

  if ! json_get "$expr" "$file" >/dev/null; then
    printf 'FAIL: %s missing expected JSON path: %s\n' "$label" "$expr" >&2
    printf 'Response body follows:\n' >&2
    sed -n '1,120p' "$file" >&2
    exit 1
  fi

  printf 'PASS: %s contains %s\n' "$label" "$expr"
}

web_no_auth_body="$tmpdir/web-no-auth.txt"
web_auth_body="$tmpdir/web-auth.txt"
web_public_body="$tmpdir/web-public.txt"
api_no_auth_body="$tmpdir/api-no-auth.txt"
api_auth_body="$tmpdir/api-auth.txt"
api_bootstrap_body="$tmpdir/api-bootstrap.txt"
api_import_body="$tmpdir/api-import.txt"
api_detail_body="$tmpdir/api-detail.txt"
api_detail_after_patch_body="$tmpdir/api-detail-after-patch.txt"
api_detail_after_attempt_body="$tmpdir/api-detail-after-attempt.txt"
api_summary_body="$tmpdir/api-summary.txt"
api_patch_body="$tmpdir/api-patch.txt"
api_attempt_body="$tmpdir/api-attempt.txt"
twilio_body="$tmpdir/twilio.txt"

print_section "0. web / public home without auth"
web_public_status="$(
  curl -sS -o "$web_public_body" -w '%{http_code}' \
    "${WEB_URL%/}/"
)"
check_status "web / public home without auth" "200" "$web_public_status"

print_section "1. web /calls without auth"
web_no_auth_status="$(
  curl -sS -o "$web_no_auth_body" -w '%{http_code}' \
    "${WEB_URL%/}/calls"
)"
check_status "web /calls without auth" "401" "$web_no_auth_status"

print_section "2. web /calls with auth"
web_auth_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$web_auth_body" -w '%{http_code}' \
    "${WEB_URL%/}/calls"
)"
check_status "web /calls with auth" "200" "$web_auth_status"

print_section "3. api /v1/calls without auth"
api_no_auth_status="$(
  curl -sS -o "$api_no_auth_body" -w '%{http_code}' \
    "${API_URL%/}/v1/calls"
)"
check_status "api /v1/calls without auth" "401" "$api_no_auth_status"

print_section "4. api /v1/calls with auth"
api_auth_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_auth_body" -w '%{http_code}' \
    "${API_URL%/}/v1/calls"
)"
check_status "api /v1/calls with auth" "200" "$api_auth_status"

print_section "5. api /v1/bootstrap with auth"
api_bootstrap_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_bootstrap_body" -w '%{http_code}' \
    "${API_URL%/}/v1/bootstrap"
)"
check_status "api /v1/bootstrap with auth" "200" "$api_bootstrap_status"
assert_json_path "api /v1/bootstrap with auth" 'data.tenant.businesses[0].id' "$api_bootstrap_body"

business_id="$(json_get 'data.tenant.businesses[0].id' "$api_bootstrap_body")"
smoke_email="prod-smoke@frontdesk.test"
smoke_phone="+1 703 555 0199"
smoke_status="READY"
smoke_follow_up="$(node -e 'process.stdout.write(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())')"

print_section "6. api prospect import with auth"
api_import_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_import_body" -w '%{http_code}' \
    -X POST "${API_URL%/}/v1/businesses/${business_id}/prospects/import" \
    -H 'content-type: application/json' \
    --data "{
      \"prospects\": [
        {
          \"companyName\": \"Prod Smoke HVAC\",
          \"contactName\": \"Smoke Operator\",
          \"contactPhone\": \"${smoke_phone}\",
          \"contactEmail\": \"${smoke_email}\",
          \"sourceLabel\": \"prod_smoke\",
          \"status\": \"${smoke_status}\",
          \"nextActionAt\": \"${smoke_follow_up}\",
          \"notes\": \"Production smoke prospect.\"
        }
      ]
    }"
)"
check_status "api prospect import with auth" "200" "$api_import_status"
assert_json_path "api prospect import with auth" 'data.prospects[0].prospectSid' "$api_import_body"

prospect_sid="$(json_get 'data.prospects[0].prospectSid' "$api_import_body")"

print_section "7. api prospect detail read with auth"
api_detail_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_detail_body" -w '%{http_code}' \
    "${API_URL%/}/v1/businesses/${business_id}/prospects/${prospect_sid}"
)"
check_status "api prospect detail read with auth" "200" "$api_detail_status"
assert_json_path "api prospect detail read with auth" 'data.prospect.readState.hasNextAction' "$api_detail_body"
assert_json_path "api prospect detail read with auth" 'data.prospect.readState.isTerminal' "$api_detail_body"

if [[ "$(json_get 'data.prospect.status' "$api_detail_body")" != "$smoke_status" ]]; then
  printf 'FAIL: expected imported smoke prospect to start in status %s\n' "$smoke_status" >&2
  sed -n '1,120p' "$api_detail_body" >&2
  exit 1
fi

if [[ "$(json_get 'data.prospect.readState.hasNextAction' "$api_detail_body")" != "true" ]]; then
  printf 'FAIL: expected imported smoke prospect to be actionable before terminal patch\n' >&2
  sed -n '1,120p' "$api_detail_body" >&2
  exit 1
fi

if [[ "$(json_get 'data.prospect.readState.isTerminal' "$api_detail_body")" == "true" ]]; then
  printf 'FAIL: smoke prospect should start non-terminal so the terminal transition can be exercised\n' >&2
  sed -n '1,120p' "$api_detail_body" >&2
  exit 1
fi

print_section "8. api prospect summary read with auth"
api_summary_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_summary_body" -w '%{http_code}' \
    "${API_URL%/}/v1/businesses/${business_id}/prospects/summary"
)"
check_status "api prospect summary read with auth" "200" "$api_summary_status"
assert_json_path "api prospect summary read with auth" 'data.summary.active' "$api_summary_body"
assert_json_path "api prospect summary read with auth" 'data.summary.terminal' "$api_summary_body"

print_section "9. api prospect patch to terminal with auth"
api_patch_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_patch_body" -w '%{http_code}' \
    -X PATCH "${API_URL%/}/v1/businesses/${business_id}/prospects/${prospect_sid}" \
    -H 'content-type: application/json' \
    --data '{
      "status": "RESPONDED",
      "notes": "Smoke terminal transition",
      "nextActionAt": null
    }'
)"
check_status "api prospect patch to terminal with auth" "200" "$api_patch_status"
assert_json_path "api prospect patch to terminal with auth" 'data.prospect.status' "$api_patch_body"
assert_json_path "api prospect patch to terminal with auth" 'data.prospect.nextActionAt' "$api_patch_body"

if [[ "$(json_get 'data.prospect.status' "$api_patch_body")" != "RESPONDED" ]]; then
  printf 'FAIL: expected smoke prospect patch to transition to RESPONDED\n' >&2
  sed -n '1,120p' "$api_patch_body" >&2
  exit 1
fi

print_section "10. api prospect detail reflects terminal read-state"
api_detail_after_patch_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_detail_after_patch_body" -w '%{http_code}' \
    "${API_URL%/}/v1/businesses/${business_id}/prospects/${prospect_sid}"
)"
check_status "api prospect detail reflects terminal read-state" "200" "$api_detail_after_patch_status"

terminal_state="$(json_get 'data.prospect.readState.isTerminal' "$api_detail_after_patch_body")"
if [[ "$terminal_state" != "true" ]]; then
  printf 'FAIL: expected terminal prospect readState.isTerminal to be true after patch, got %s\n' "$terminal_state" >&2
  sed -n '1,120p' "$api_detail_after_patch_body" >&2
  exit 1
fi

next_action_value="$(json_get 'data.prospect.nextActionAt' "$api_detail_after_patch_body")"
if [[ "$next_action_value" != "null" ]]; then
  printf 'FAIL: expected terminal prospect nextActionAt to clear to null, got %s\n' "$next_action_value" >&2
  sed -n '1,120p' "$api_detail_after_patch_body" >&2
  exit 1
fi

print_section "11. api prospect attempt on terminal prospect"
attempted_at="$(node -e 'process.stdout.write(new Date().toISOString())')"
api_attempt_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_attempt_body" -w '%{http_code}' \
    -X POST "${API_URL%/}/v1/businesses/${business_id}/prospects/${prospect_sid}/attempts" \
    -H 'content-type: application/json' \
    --data "{
      \"channel\": \"CALL\",
      \"outcome\": \"NO_ANSWER\",
      \"note\": \"Smoke attempt after terminal transition\",
      \"attemptedAt\": \"${attempted_at}\"
    }"
)"
check_status "api prospect attempt on terminal prospect" "200" "$api_attempt_status"
assert_json_path "api prospect attempt on terminal prospect" 'data.attempt.id' "$api_attempt_body"

print_section "12. api prospect detail reflects last attempt without downgrading terminal status"
api_detail_after_attempt_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$api_detail_after_attempt_body" -w '%{http_code}' \
    "${API_URL%/}/v1/businesses/${business_id}/prospects/${prospect_sid}"
)"
check_status "api prospect detail reflects last attempt without downgrading terminal status" "200" "$api_detail_after_attempt_status"

post_attempt_status="$(json_get 'data.prospect.status' "$api_detail_after_attempt_body")"
if [[ "$post_attempt_status" != "RESPONDED" ]]; then
  printf 'FAIL: expected terminal status to remain RESPONDED after attempt, got %s\n' "$post_attempt_status" >&2
  sed -n '1,120p' "$api_detail_after_attempt_body" >&2
  exit 1
fi

last_attempt_at="$(json_get 'data.prospect.lastAttemptAt' "$api_detail_after_attempt_body")"
if [[ "$last_attempt_at" == "null" ]]; then
  printf 'FAIL: expected lastAttemptAt to be populated after attempt\n' >&2
  sed -n '1,120p' "$api_detail_after_attempt_body" >&2
  exit 1
fi

read_state_after_attempt="$(json_get 'data.prospect.readState.isTerminal' "$api_detail_after_attempt_body")"
if [[ "$read_state_after_attempt" != "true" ]]; then
  printf 'FAIL: expected readState.isTerminal to stay true after terminal attempt, got %s\n' "$read_state_after_attempt" >&2
  sed -n '1,120p' "$api_detail_after_attempt_body" >&2
  exit 1
fi

print_section "13. web prospect detail with auth"
web_prospect_detail_status="$(
  curl -sS -u "$OPS_USER:$OPS_PASS" -o "$tmpdir/web-prospect-detail.txt" -w '%{http_code}' \
    "${WEB_URL%/}/prospects/${prospect_sid}"
)"
check_status "web prospect detail with auth" "200" "$web_prospect_detail_status"

print_section "14. api inbound Twilio webhook POST"
twilio_status="$(
  curl -sS -o "$twilio_body" -w '%{http_code}' \
    -X POST "${API_URL%/}/v1/twilio/voice/inbound" \
    --data-urlencode "CallSid=$TWILIO_CALL_SID" \
    --data-urlencode "From=$TWILIO_FROM_E164" \
    --data-urlencode "To=$TWILIO_TO_E164"
)"
check_status "api inbound Twilio webhook POST" "200" "$twilio_status"
contains_or_fail "api inbound Twilio webhook POST" "<Connect>" "$twilio_body"
contains_or_fail "api inbound Twilio webhook POST" "/ws/media-stream" "$twilio_body"

print_section "Smoke test complete"
printf 'All production smoke checks passed.\n'
