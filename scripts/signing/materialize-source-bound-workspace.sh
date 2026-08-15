#!/usr/bin/env bash
set -euo pipefail
set +x

SOURCE_COMMIT="${1:?source commit sha required}"
GENERATOR_BLOB="${2:?generator blob sha required}"
MATERIALIZER_ID="${3:?materializer id required}"
LANE="${4:?lane required}"
JOB_ID="${5:?job id required}"

[[ "$SOURCE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid source commit" >&2; exit 2; }
[[ "$GENERATOR_BLOB" =~ ^[0-9a-f]{40}$ ]] || { echo "Invalid generator blob" >&2; exit 2; }
[[ "$MATERIALIZER_ID" == "snake-capacitor-v1" ]] || { echo "Unsupported materializer" >&2; exit 2; }
[[ "$LANE" == "android" || "$LANE" == "ios" ]] || { echo "Unsupported lane" >&2; exit 2; }
[[ "$JOB_ID" =~ ^[0-9a-fA-F-]{36}$ ]] || { echo "Invalid job id" >&2; exit 2; }

command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 2; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 2; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 2; }

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if ! git cat-file -e "$SOURCE_COMMIT^{commit}" 2>/dev/null; then
  git fetch --no-tags --depth=1 origin "$SOURCE_COMMIT" >/dev/null 2>&1 || {
    git fetch --no-tags origin foundation-v0.1 >/dev/null 2>&1 || true
  }
fi
git cat-file -e "$SOURCE_COMMIT^{commit}" 2>/dev/null || { echo "Approved source commit is unavailable" >&2; exit 3; }

ACTUAL_GENERATOR_BLOB="$(git rev-parse "$SOURCE_COMMIT:src/implementation/generator.ts")"
[[ "$ACTUAL_GENERATOR_BLOB" == "$GENERATOR_BLOB" ]] || {
  echo "Generator blob does not match approved provenance" >&2
  exit 4
}

STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
WORKTREE_BASE="$STATE_DIR/signing-worktrees/$JOB_ID"
SOURCE_ROOT="$WORKTREE_BASE/source"
mkdir -p "$(dirname "$WORKTREE_BASE")"
chmod 700 "$STATE_DIR" 2>/dev/null || true

if [[ -d "$SOURCE_ROOT" ]]; then
  git worktree remove --force "$SOURCE_ROOT" >/dev/null 2>&1 || rm -rf "$SOURCE_ROOT"
fi
rm -rf "$WORKTREE_BASE"
mkdir -p "$WORKTREE_BASE"
git worktree add --detach "$SOURCE_ROOT" "$SOURCE_COMMIT" >/dev/null

cleanup_on_error(){
  local code=$?
  if [[ $code -ne 0 ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$SOURCE_ROOT" >/dev/null 2>&1 || true
    rm -rf "$WORKTREE_BASE"
  fi
  exit "$code"
}
trap cleanup_on_error ERR INT TERM

pushd "$SOURCE_ROOT" >/dev/null
npm install --no-audit --no-fund --ignore-scripts >/dev/null
npx tsx scripts/generate-snake-ci.ts >/dev/null
[[ -d .ci-workspaces/snake-game/build ]] || { echo "Approved source materialization failed" >&2; exit 5; }

if [[ "$LANE" == "android" ]]; then
  NATIVE_ROOT="$SOURCE_ROOT/.smartos-native/snake-capacitor"
  rm -rf "$NATIVE_ROOT"
  mkdir -p "$NATIVE_ROOT/www"
  cp -R .ci-workspaces/snake-game/build/. "$NATIVE_ROOT/www/"
  pushd "$NATIVE_ROOT" >/dev/null
  npm init -y >/dev/null
  npm install --no-audit --no-fund --save-exact @capacitor/core@8.4.2 @capacitor/cli@8.4.2 @capacitor/android@8.4.2 >/dev/null
  node -e "require('fs').writeFileSync('capacitor.config.json', JSON.stringify({appId:'ai.smartos.snake',appName:'SMART OS Snake',webDir:'www'}, null, 2))"
  npx cap add android >/dev/null
  chmod +x android/gradlew
  popd >/dev/null
  WORKSPACE="$NATIVE_ROOT/android"
  OUTPUT="$WORKSPACE/app/build/outputs/bundle/release/app-release.aab"
else
  [[ "$(uname -s)" == "Darwin" ]] || { echo "iOS source materialization requires macOS" >&2; exit 2; }
  NATIVE_ROOT="$SOURCE_ROOT/.smartos-native/snake-capacitor-ios"
  rm -rf "$NATIVE_ROOT"
  mkdir -p "$NATIVE_ROOT/www"
  cp -R .ci-workspaces/snake-game/build/. "$NATIVE_ROOT/www/"
  pushd "$NATIVE_ROOT" >/dev/null
  npm init -y >/dev/null
  npm install --no-audit --no-fund --save-exact @capacitor/core@8.4.2 @capacitor/cli@8.4.2 @capacitor/ios@8.4.2 >/dev/null
  node -e "require('fs').writeFileSync('capacitor.config.json', JSON.stringify({appId:'ai.smartos.snake',appName:'SMART OS Snake',webDir:'www'}, null, 2))"
  npx cap add ios >/dev/null
  popd >/dev/null
  WORKSPACE="$NATIVE_ROOT/ios"
  OUTPUT="$WORKSPACE/build/SmartOS.xcarchive"
fi
popd >/dev/null

python3 - "$WORKSPACE" "$OUTPUT" "$SOURCE_ROOT" "$SOURCE_COMMIT" "$GENERATOR_BLOB" "$MATERIALIZER_ID" <<'PY'
import json,sys
print(json.dumps({
  "workspace": sys.argv[1],
  "outputPath": sys.argv[2],
  "sourceRoot": sys.argv[3],
  "sourceCommitSha": sys.argv[4],
  "generatorBlobSha": sys.argv[5],
  "materializerId": sys.argv[6],
}))
PY
