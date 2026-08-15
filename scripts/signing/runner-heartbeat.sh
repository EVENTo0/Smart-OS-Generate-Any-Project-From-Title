#!/usr/bin/env bash
set -euo pipefail
set +x

STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
TOKEN_FILE="$STATE_DIR/runner-token"
META_FILE="$STATE_DIR/runner.json"
[[ -f "$TOKEN_FILE" && -f "$META_FILE" ]] || { echo "Runner is not enrolled" >&2; exit 2; }

RUNNER_TOKEN="$(cat "$TOKEN_FILE")"
RUNNER_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runnerId"])' "$META_FILE")"
ENDPOINT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["endpoint"])' "$META_FILE")"

TOOLS=()
for tool in git node npm xcodebuild security gradle java jarsigner; do
  command -v "$tool" >/dev/null 2>&1 && TOOLS+=("$tool")
done
[[ -x ./gradlew ]] && TOOLS+=("./gradlew")

SECRET_REFS=()
for name in \
  ANDROID_UPLOAD_KEYSTORE \
  ANDROID_UPLOAD_KEYSTORE_PASSWORD \
  ANDROID_UPLOAD_KEY_ALIAS \
  ANDROID_UPLOAD_KEY_PASSWORD \
  APPLE_DEVELOPMENT_TEAM_ID \
  APPLE_SIGNING_CERTIFICATE \
  APPLE_SIGNING_CERTIFICATE_PASSWORD \
  APPLE_PROVISIONING_PROFILE; do
  [[ -n "${!name:-}" ]] && SECRET_REFS+=("$name")
done

PAYLOAD="$(python3 - "$RUNNER_ID" "${TOOLS[*]}" "${SECRET_REFS[*]}" <<'PY'
import json, sys
print(json.dumps({
  "action": "heartbeat",
  "runnerId": sys.argv[1],
  "tools": [x for x in sys.argv[2].split() if x],
  "availableSecretRefs": [x for x in sys.argv[3].split() if x],
}))
PY
)"

RESPONSE="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
  --data "$PAYLOAD" \
  "$ENDPOINT")"

python3 - "$RESPONSE" <<'PY'
import json, sys
p=json.loads(sys.argv[1])
if "error" in p: raise SystemExit(p["error"])
print("SMART OS runner heartbeat accepted")
print("runnerId:", p["runnerId"])
print("lane:", p["lane"])
print("readyForSigning:", p["readyForSigning"])
print("missingSecretRefs:", ", ".join(p.get("missingSecretRefs", [])) or "none")
print("lastHeartbeatAt:", p["lastHeartbeatAt"])
PY

unset RUNNER_TOKEN
