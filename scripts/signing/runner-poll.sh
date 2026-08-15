#!/usr/bin/env bash
set -euo pipefail
set +x

STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
TOKEN_FILE="$STATE_DIR/runner-token"
META_FILE="$STATE_DIR/runner.json"
[[ -f "$TOKEN_FILE" && -f "$META_FILE" ]] || { echo "Runner is not enrolled" >&2; exit 2; }
for required in scripts/signing/materialize-source-bound-workspace.sh scripts/signing/android-sign-and-bundle.sh scripts/signing/ios-sign-and-archive.sh scripts/signing/runner-heartbeat.sh; do
  [[ -f "$required" ]] || { echo "Run from the SMART OS repository root; missing $required" >&2; exit 2; }
done

REPO_ROOT="$(git rev-parse --show-toplevel)"
RUNNER_TOKEN="$(cat "$TOKEN_FILE")"
RUNNER_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runnerId"])' "$META_FILE")"
RUNNER_ENDPOINT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["endpoint"])' "$META_FILE")"
JOB_ENDPOINT="${SMART_OS_SIGNING_JOBS_ENDPOINT:-${RUNNER_ENDPOINT%/smart-os-runner}/smart-os-signing-jobs}"

bash scripts/signing/runner-heartbeat.sh >/dev/null

TMP_DIR="$(mktemp -d)"
SOURCE_ROOT=""
cleanup(){
  if [[ -n "$SOURCE_ROOT" && -d "$SOURCE_ROOT" ]]; then
    git -C "$REPO_ROOT" worktree remove --force "$SOURCE_ROOT" >/dev/null 2>&1 || true
    rm -rf "$(dirname "$SOURCE_ROOT")" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
  unset RUNNER_TOKEN
}
trap cleanup EXIT INT TERM

NEXT_RESPONSE="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
  --data "$(python3 - "$RUNNER_ID" <<'PY'
import json,sys
print(json.dumps({"action":"next-job","runnerId":sys.argv[1]}))
PY
)" \
  "$JOB_ENDPOINT")"
printf '%s' "$NEXT_RESPONSE" > "$TMP_DIR/job.json"

if python3 - "$TMP_DIR/job.json" <<'PY'
import json,sys
p=json.load(open(sys.argv[1]))
raise SystemExit(0 if p.get("noJob") is True else 1)
PY
then
  echo "No signing job queued for $RUNNER_ID"
  exit 0
fi

python3 - "$TMP_DIR/job.json" "$RUNNER_ID" > "$TMP_DIR/job.env" <<'PY'
import json,re,shlex,sys
p=json.load(open(sys.argv[1]))
runner=sys.argv[2]
if p.get("runner_id") != runner or p.get("status") != "leased":
    raise SystemExit("Signing job runner/status mismatch")
if p.get("publicPublishAuthorized") is not False or p.get("storeUploadAuthorized") is not False:
    raise SystemExit("Signing job attempted to expand publication authority")
job_id=str(p.get("job_id", "")); lane=str(p.get("lane", "")); project=str(p.get("project_id", "")); version=str(p.get("version", ""))
fingerprint=str(p.get("candidate_fingerprint", "")); source_commit=str(p.get("source_commit_sha", "")); generator_blob=str(p.get("generator_blob_sha", "")); materializer=str(p.get("materializer_id", ""))
if not re.fullmatch(r"[0-9a-fA-F-]{36}", job_id): raise SystemExit("Unsafe signing job id")
if lane not in {"android","ios"}: raise SystemExit("Unsupported signing lane")
if not re.fullmatch(r"[A-Za-z0-9._:-]+", project): raise SystemExit("Unsafe project id")
if not re.fullmatch(r"sha256:[0-9a-fA-F]{64}", fingerprint): raise SystemExit("Invalid candidate fingerprint")
if not re.fullmatch(r"[0-9a-f]{40}", source_commit): raise SystemExit("Invalid source commit provenance")
if not re.fullmatch(r"[0-9a-f]{40}", generator_blob): raise SystemExit("Invalid generator blob provenance")
if materializer != "snake-capacitor-v1": raise SystemExit("Unsupported signing materializer")
command=p.get("command") or {}; exe=command.get("executable"); args=command.get("args")
expected_exe="smart-os-sign-android" if lane=="android" else "smart-os-sign-ios"
if command.get("workingDirectory") != "." or exe != expected_exe or args != [f"source-bound:{materializer}"]:
    raise SystemExit("Signing job command failed declarative allowlist validation")
safe_version=re.sub(r"[^A-Za-z0-9._-]", "-", version)
expected_logical=(f"signed/{project}/{safe_version}/android/app-release.aab" if lane=="android" else f"signed/{project}/{safe_version}/ios/SmartOS.xcarchive")
if p.get("output_path") != expected_logical: raise SystemExit("Signing job logical output path mismatch")
for key,value in {
  "JOB_ID":job_id,"LANE":lane,"PROJECT_ID":project,"VERSION":version,"CANDIDATE_FINGERPRINT":fingerprint,
  "ADAPTER":expected_exe,"SOURCE_COMMIT":source_commit,"GENERATOR_BLOB":generator_blob,"MATERIALIZER_ID":materializer,
  "LOGICAL_OUTPUT_PATH":expected_logical
}.items(): print(f"{key}={shlex.quote(value)}")
PY
# shellcheck disable=SC1090
source "$TMP_DIR/job.env"

MATERIALIZED_JSON="$(bash scripts/signing/materialize-source-bound-workspace.sh "$SOURCE_COMMIT" "$GENERATOR_BLOB" "$MATERIALIZER_ID" "$LANE" "$JOB_ID")"
printf '%s' "$MATERIALIZED_JSON" > "$TMP_DIR/materialized.json"
python3 - "$TMP_DIR/materialized.json" "$SOURCE_COMMIT" "$GENERATOR_BLOB" "$MATERIALIZER_ID" > "$TMP_DIR/materialized.env" <<'PY'
import json,os,shlex,sys
p=json.load(open(sys.argv[1]))
if p.get("sourceCommitSha") != sys.argv[2] or p.get("generatorBlobSha") != sys.argv[3] or p.get("materializerId") != sys.argv[4]:
    raise SystemExit("Materialized workspace provenance mismatch")
workspace=os.path.realpath(str(p.get("workspace", "")))
output=os.path.realpath(str(p.get("outputPath", "")))
source_root=os.path.realpath(str(p.get("sourceRoot", "")))
if not workspace or not output or not source_root: raise SystemExit("Materializer returned incomplete paths")
for key,value in {"WORKSPACE":workspace,"OUTPUT_PATH":output,"SOURCE_ROOT":source_root}.items(): print(f"{key}={shlex.quote(value)}")
PY
# shellcheck disable=SC1090
source "$TMP_DIR/materialized.env"

case "$ADAPTER" in
  smart-os-sign-android) ADAPTER_SCRIPT="scripts/signing/android-sign-and-bundle.sh" ;;
  smart-os-sign-ios) ADAPTER_SCRIPT="scripts/signing/ios-sign-and-archive.sh" ;;
  *) echo "Rejected non-allowlisted signing adapter" >&2; exit 4 ;;
esac

complete_failed(){
  local summary="$1"
  curl --fail-with-body --silent --show-error \
    -H 'Content-Type: application/json' \
    -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
    --data "$(python3 - "$RUNNER_ID" "$JOB_ID" "$SOURCE_COMMIT" "$GENERATOR_BLOB" "$MATERIALIZER_ID" "$summary" <<'PY'
import json,sys
print(json.dumps({
  "action":"complete-job","runnerId":sys.argv[1],"jobId":sys.argv[2],"result":"failed",
  "sourceCommitSha":sys.argv[3],"generatorBlobSha":sys.argv[4],"materializerId":sys.argv[5],
  "resultSummary":sys.argv[6][:500]
}))
PY
)" "$JOB_ENDPOINT" >/dev/null || true
}

set +e
bash "$ADAPTER_SCRIPT" "$WORKSPACE" >"$TMP_DIR/adapter.out" 2>"$TMP_DIR/adapter.err"
ADAPTER_EXIT=$?
set -e

if [[ $ADAPTER_EXIT -ne 0 ]]; then
  complete_failed "source-bound runner-local signing adapter failed with exit code $ADAPTER_EXIT"
  echo "Signing job $JOB_ID failed locally (exit $ADAPTER_EXIT). Adapter stderr was not uploaded." >&2
  exit "$ADAPTER_EXIT"
fi

if [[ "$LANE" == "android" ]]; then
  [[ -f "$OUTPUT_PATH" ]] || { complete_failed "expected Android AAB missing after adapter success"; echo "Expected AAB missing" >&2; exit 5; }
else
  [[ -d "$OUTPUT_PATH" ]] || { complete_failed "expected iOS XCArchive missing after adapter success"; echo "Expected XCArchive missing" >&2; exit 5; }
fi

read -r ARTIFACT_SHA ARTIFACT_SIZE < <(python3 - "$OUTPUT_PATH" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path(sys.argv[1]); h=hashlib.sha256(); size=0
if root.is_file():
    with root.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk); size += len(chunk)
elif root.is_dir():
    for path in sorted((p for p in root.rglob('*') if p.is_file()), key=lambda p:p.relative_to(root).as_posix()):
        rel=path.relative_to(root).as_posix().encode(); h.update(len(rel).to_bytes(8,'big')); h.update(rel)
        with path.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''): h.update(chunk); size += len(chunk)
else: raise SystemExit("Artifact path missing")
print("sha256:"+h.hexdigest(), size)
PY
)

COMPLETE_RESPONSE="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
  --data "$(python3 - "$RUNNER_ID" "$JOB_ID" "$SOURCE_COMMIT" "$GENERATOR_BLOB" "$MATERIALIZER_ID" "$ARTIFACT_SHA" "$ARTIFACT_SIZE" <<'PY'
import json,sys
print(json.dumps({
  "action":"complete-job","runnerId":sys.argv[1],"jobId":sys.argv[2],"result":"succeeded",
  "sourceCommitSha":sys.argv[3],"generatorBlobSha":sys.argv[4],"materializerId":sys.argv[5],
  "artifactSha256":sys.argv[6],"artifactSizeBytes":int(sys.argv[7]),
  "resultSummary":"source provenance verified; signed package produced and locally verified; publication not authorized"
}))
PY
)" "$JOB_ENDPOINT")"

python3 - "$COMPLETE_RESPONSE" <<'PY'
import json,sys
p=json.loads(sys.argv[1])
if p.get("status") != "succeeded": raise SystemExit(p.get("error","Signing completion was not accepted"))
print("Signing job completed")
print("jobId:", p["jobId"])
print("sourceCommitSha:", p["sourceCommitSha"])
print("generatorBlobSha:", p["generatorBlobSha"])
print("artifactSha256:", p["artifactSha256"])
print("artifactSizeBytes:", p["artifactSizeBytes"])
print("Store/production publishing remains locked.")
PY
