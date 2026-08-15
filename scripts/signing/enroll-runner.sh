#!/usr/bin/env bash
set -euo pipefail
set +x

: "${SMART_OS_ENROLLMENT_ID:?Set SMART_OS_ENROLLMENT_ID from the phone pairing screen}"
: "${SMART_OS_PAIRING_TOKEN:?Set SMART_OS_PAIRING_TOKEN from the phone pairing screen}"

SMART_OS_RUNNER_ENDPOINT="${SMART_OS_RUNNER_ENDPOINT:-https://vzfltlqmkvrlhuppeqmy.supabase.co/functions/v1/smart-os-runner}"
STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"

case "$(uname -s)" in
  Darwin) HOST_PLATFORM="macos" ;;
  Linux) HOST_PLATFORM="linux" ;;
  MINGW*|MSYS*|CYGWIN*) HOST_PLATFORM="windows" ;;
  *) echo "Unsupported host platform" >&2; exit 2 ;;
esac

TOOLS=()
command -v xcodebuild >/dev/null 2>&1 && TOOLS+=("xcodebuild")
command -v gradle >/dev/null 2>&1 && TOOLS+=("gradle")
[[ -x ./gradlew ]] && TOOLS+=("./gradlew")
command -v java >/dev/null 2>&1 && TOOLS+=("java")

SECRET_REFS=()
for name in \
  ANDROID_UPLOAD_KEYSTORE \
  ANDROID_UPLOAD_KEYSTORE_PASSWORD \
  ANDROID_UPLOAD_KEY_ALIAS \
  ANDROID_UPLOAD_KEY_PASSWORD \
  APPLE_DEVELOPMENT_TEAM_ID \
  APPLE_SIGNING_CERTIFICATE \
  APPLE_PROVISIONING_PROFILE; do
  [[ -n "${!name:-}" ]] && SECRET_REFS+=("$name")
done

PAYLOAD="$(python3 - "$SMART_OS_ENROLLMENT_ID" "$SMART_OS_PAIRING_TOKEN" "$HOST_PLATFORM" "${TOOLS[*]}" "${SECRET_REFS[*]}" <<'PY'
import json, sys
print(json.dumps({
  "action": "claim",
  "enrollmentId": sys.argv[1],
  "pairingToken": sys.argv[2],
  "hostPlatform": sys.argv[3],
  "tools": [x for x in sys.argv[4].split() if x],
  "availableSecretRefs": [x for x in sys.argv[5].split() if x],
}))
PY
)"

RESPONSE="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  --data "$PAYLOAD" \
  "$SMART_OS_RUNNER_ENDPOINT")"

python3 - "$RESPONSE" "$STATE_DIR" "$SMART_OS_RUNNER_ENDPOINT" <<'PY'
import json, os, pathlib, sys
payload = json.loads(sys.argv[1])
if "runnerToken" not in payload:
    raise SystemExit(payload.get("error", "Runner enrollment failed"))
state_dir = pathlib.Path(sys.argv[2])
endpoint = sys.argv[3]
(state_dir / "runner-token").write_text(payload["runnerToken"], encoding="utf-8")
os.chmod(state_dir / "runner-token", 0o600)
(state_dir / "runner.json").write_text(json.dumps({
    "runnerId": payload["runnerId"],
    "lane": payload["lane"],
    "endpoint": endpoint,
    "credentialExpiresAt": payload["credentialExpiresAt"],
}, indent=2), encoding="utf-8")
os.chmod(state_dir / "runner.json", 0o600)
print("SMART OS runner enrolled")
print("runnerId:", payload["runnerId"])
print("lane:", payload["lane"])
print("readyForSigning:", payload["readyForSigning"])
print("missingSecretRefs:", ", ".join(payload.get("missingSecretRefs", [])) or "none")
print("Runner credential stored locally with mode 0600; token value was not printed.")
PY

unset SMART_OS_PAIRING_TOKEN
