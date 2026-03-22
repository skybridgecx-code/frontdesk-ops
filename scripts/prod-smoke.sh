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

web_no_auth_body="$tmpdir/web-no-auth.txt"
web_auth_body="$tmpdir/web-auth.txt"
api_no_auth_body="$tmpdir/api-no-auth.txt"
api_auth_body="$tmpdir/api-auth.txt"
twilio_body="$tmpdir/twilio.txt"

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

print_section "5. api inbound Twilio webhook POST"
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
