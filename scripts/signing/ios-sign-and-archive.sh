#!/usr/bin/env bash
set -euo pipefail
set +x

WORKSPACE="${1:?iOS workspace path required}"
STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
WORKSPACE="$(python3 - "$WORKSPACE" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
)"
STATE_DIR="$(python3 - "$STATE_DIR" <<'PY'
import os,sys
print(os.path.realpath(sys.argv[1]))
PY
)"
case "$WORKSPACE" in
  "$STATE_DIR"/signing-worktrees/*/source/.smartos-native/snake-capacitor-ios/ios) ;;
  *) echo "Unsafe iOS source-bound workspace path" >&2; exit 2 ;;
esac
[[ -d "$WORKSPACE" ]] || { echo "iOS workspace does not exist" >&2; exit 2; }
[[ "$(uname -s)" == "Darwin" ]] || { echo "iOS signing requires macOS" >&2; exit 2; }

: "${APPLE_DEVELOPMENT_TEAM_ID:?APPLE_DEVELOPMENT_TEAM_ID is required}"
: "${APPLE_SIGNING_CERTIFICATE:?APPLE_SIGNING_CERTIFICATE is required}"
: "${APPLE_SIGNING_CERTIFICATE_PASSWORD:?APPLE_SIGNING_CERTIFICATE_PASSWORD is required}"
: "${APPLE_PROVISIONING_PROFILE:?APPLE_PROVISIONING_PROFILE is required}"
command -v xcodebuild >/dev/null 2>&1 || { echo "xcodebuild is required" >&2; exit 2; }
command -v security >/dev/null 2>&1 || { echo "security is required" >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
KEYCHAIN="$TMP_DIR/smart-os-signing.keychain-db"
KEYCHAIN_PASSWORD="$(uuidgen | tr -d '-')"
PROFILE_DEST=""
PROFILE_CREATED=0
cleanup(){
  security delete-keychain "$KEYCHAIN" >/dev/null 2>&1 || true
  if [[ "$PROFILE_CREATED" == "1" && -n "$PROFILE_DEST" ]]; then rm -f "$PROFILE_DEST"; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

materialize(){
  local value="$1" out="$2"
  if [[ -f "$value" ]]; then
    cp "$value" "$out"
  else
    python3 - "$value" "$out" <<'PY'
import base64, pathlib, sys
try:
    pathlib.Path(sys.argv[2]).write_bytes(base64.b64decode(sys.argv[1], validate=True))
except Exception as exc:
    raise SystemExit("Signing material must be an existing file path or valid base64") from exc
PY
  fi
  chmod 600 "$out"
}

CERT_FILE="$TMP_DIR/signing.p12"
PROFILE_FILE="$TMP_DIR/profile.mobileprovision"
PROFILE_PLIST="$TMP_DIR/profile.plist"
materialize "$APPLE_SIGNING_CERTIFICATE" "$CERT_FILE"
materialize "$APPLE_PROVISIONING_PROFILE" "$PROFILE_FILE"

security cms -D -i "$PROFILE_FILE" > "$PROFILE_PLIST"
PROFILE_UUID="$(/usr/libexec/PlistBuddy -c 'Print :UUID' "$PROFILE_PLIST")"
[[ -n "$PROFILE_UUID" ]] || { echo "Provisioning profile UUID could not be read" >&2; exit 3; }
PROFILE_DIR="$HOME/Library/MobileDevice/Provisioning Profiles"
mkdir -p "$PROFILE_DIR"
PROFILE_DEST="$PROFILE_DIR/$PROFILE_UUID.mobileprovision"
if [[ ! -e "$PROFILE_DEST" ]]; then
  cp "$PROFILE_FILE" "$PROFILE_DEST"
  PROFILE_CREATED=1
fi

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN"
security import "$CERT_FILE" -k "$KEYCHAIN" -P "$APPLE_SIGNING_CERTIFICATE_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN" >/dev/null

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" | awk 'NR==1 {print $2}')"
[[ -n "$IDENTITY" && "$IDENTITY" != "0" ]] || { echo "No code-signing identity found in imported certificate" >&2; exit 3; }

ARCHIVE_PATH="$WORKSPACE/build/SmartOS.xcarchive"
rm -rf "$ARCHIVE_PATH"
pushd "$WORKSPACE" >/dev/null
xcodebuild \
  -workspace "App/App.xcworkspace" \
  -scheme "App" \
  -configuration "Release" \
  -destination "generic/platform=iOS" \
  -archivePath "build/SmartOS.xcarchive" \
  DEVELOPMENT_TEAM="$APPLE_DEVELOPMENT_TEAM_ID" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="$IDENTITY" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID" \
  OTHER_CODE_SIGN_FLAGS="--keychain $KEYCHAIN" \
  archive >/dev/null
popd >/dev/null

[[ -d "$ARCHIVE_PATH" ]] || { echo "Signed Xcode archive was not produced" >&2; exit 3; }
printf '%s\n' "$ARCHIVE_PATH"
