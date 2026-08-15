#!/usr/bin/env bash
set -euo pipefail
set +x

WORKSPACE="${1:?Android workspace path required}"
[[ "$WORKSPACE" =~ ^workspaces/[A-Za-z0-9._:-]+/build/android$ ]] || { echo "Unsafe Android workspace path" >&2; exit 2; }
[[ -d "$WORKSPACE" ]] || { echo "Android workspace does not exist" >&2; exit 2; }

: "${ANDROID_UPLOAD_KEYSTORE:?ANDROID_UPLOAD_KEYSTORE is required}"
: "${ANDROID_UPLOAD_KEYSTORE_PASSWORD:?ANDROID_UPLOAD_KEYSTORE_PASSWORD is required}"
: "${ANDROID_UPLOAD_KEY_ALIAS:?ANDROID_UPLOAD_KEY_ALIAS is required}"
: "${ANDROID_UPLOAD_KEY_PASSWORD:?ANDROID_UPLOAD_KEY_PASSWORD is required}"
command -v jarsigner >/dev/null 2>&1 || { echo "jarsigner is required" >&2; exit 2; }

TMP_DIR="$(mktemp -d)"
cleanup(){ rm -rf "$TMP_DIR"; }
trap cleanup EXIT INT TERM

if [[ -f "$ANDROID_UPLOAD_KEYSTORE" ]]; then
  KEYSTORE_PATH="$ANDROID_UPLOAD_KEYSTORE"
else
  KEYSTORE_PATH="$TMP_DIR/upload-keystore"
  python3 - "$ANDROID_UPLOAD_KEYSTORE" "$KEYSTORE_PATH" <<'PY'
import base64, pathlib, sys
try:
    pathlib.Path(sys.argv[2]).write_bytes(base64.b64decode(sys.argv[1], validate=True))
except Exception as exc:
    raise SystemExit("ANDROID_UPLOAD_KEYSTORE must be an existing file path or valid base64") from exc
PY
  chmod 600 "$KEYSTORE_PATH"
fi

pushd "$WORKSPACE" >/dev/null
if [[ -x ./gradlew ]]; then
  ./gradlew bundleRelease
elif command -v gradle >/dev/null 2>&1; then
  gradle bundleRelease
else
  echo "Gradle or ./gradlew is required" >&2
  exit 2
fi

AAB="app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB" ]]; then
  AAB="$(find app/build/outputs/bundle/release -maxdepth 1 -type f -name '*.aab' -print -quit 2>/dev/null || true)"
fi
[[ -n "$AAB" && -f "$AAB" ]] || { echo "Release AAB was not produced" >&2; exit 3; }

jarsigner \
  -keystore "$KEYSTORE_PATH" \
  -storepass "$ANDROID_UPLOAD_KEYSTORE_PASSWORD" \
  -keypass "$ANDROID_UPLOAD_KEY_PASSWORD" \
  "$AAB" \
  "$ANDROID_UPLOAD_KEY_ALIAS" >/dev/null
jarsigner -verify "$AAB" >/dev/null

printf '%s\n' "$WORKSPACE/$AAB"
popd >/dev/null
