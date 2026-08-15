#!/usr/bin/env bash
set -euo pipefail

lane="${1:-}"
if [[ "$lane" != "android" && "$lane" != "ios" ]]; then
  echo '{"ready":false,"reason":"lane-must-be-android-or-ios"}'
  exit 2
fi

missing=()
required=()
if [[ "$lane" == "android" ]]; then
  required=(ANDROID_UPLOAD_KEYSTORE ANDROID_UPLOAD_KEYSTORE_PASSWORD ANDROID_UPLOAD_KEY_ALIAS ANDROID_UPLOAD_KEY_PASSWORD)
  command -v java >/dev/null 2>&1 || missing+=(tool:java)
  if [[ ! -x ./gradlew ]] && ! command -v gradle >/dev/null 2>&1; then
    missing+=(tool:gradle)
  fi
else
  required=(APPLE_DEVELOPMENT_TEAM_ID APPLE_SIGNING_CERTIFICATE APPLE_PROVISIONING_PROFILE)
  [[ "$(uname -s)" == "Darwin" ]] || missing+=(host:macos)
  command -v xcodebuild >/dev/null 2>&1 || missing+=(tool:xcodebuild)
fi

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("secret-ref:${name}")
  fi
done

if (( ${#missing[@]} > 0 )); then
  printf '{"ready":false,"lane":"%s","missing":[' "$lane"
  first=1
  for item in "${missing[@]}"; do
    (( first )) || printf ','
    first=0
    printf '"%s"' "$item"
  done
  printf '],"secretValuesPrinted":false,"publicPublishAuthorized":false,"storeUploadAuthorized":false}\n'
  exit 1
fi

printf '{"ready":true,"lane":"%s","secretValuesPrinted":false,"publicPublishAuthorized":false,"storeUploadAuthorized":false}\n' "$lane"
