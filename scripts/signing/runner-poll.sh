#!/usr/bin/env bash
set -euo pipefail
set +x

STATE_DIR="${SMART_OS_STATE_DIR:-$HOME/.smart-os}"
TOKEN_FILE="$STATE_DIR/runner-token"
META_FILE="$STATE_DIR/runner.json"
[[ -f "$TOKEN_FILE" && -f "$META_FILE" ]] || { echo "Runner is not enrolled" >&2; exit 2; }
[[ -f scripts/signing/android-sign-and-bundle.sh && -f scripts/signing/ios-sign-and-archive.sh ]] || { echo "Run this script from the SMART OS repository root" >&2; exit 2; }

RUNNER_TOKEN="$(cat "$TOKEN_FILE")"
RUNNER_ID="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["runnerId"])' "$META_FILE")"
RUNNER_ENDPOINT="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["endpoint"])' "$META_FILE")"
JOB_ENDPOINT="${SMART_OS_SIGNING_JOBS_ENDPOINT:-${RUNNER_ENDPOINT%/smart-os-runner}/smart-os-signing-jobs}"

# Refresh attestation before requesting work. Output contains no secret values.
bash scripts/signing/runner-heartbeat.sh >/dev/null

TMP_DIR="$(mktemp -d)"
cleanup(){ rm -rf "$TMP_DIR"; unset RUNNER_TOKEN; }
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
job_id=str(p.get("job_id", "")); lane=str(p.get("lane", "")); project=str(p.get("project_id", ""))
if not re.fullmatch(r"[0-9a-fA-F-]{36}", job_id): raise SystemExit("Unsafe signing job id")
if lane not in {"android","ios"}: raise SystemExit("Unsupported signing lane")
if not re.fullmatch(r"[A-Za-z0-9._:-]+", project): raise SystemExit("Unsafe project id")
command=p.get("command") or {}; exe=command.get("executable"); args=command.get("args")
if not isinstance(args,list) or len(args)!=1 or not isinstance(args[0],str): raise SystemExit("Signing adapter args invalid")
expected_exe="smart-os-sign-android" if lane=="android" else "smart-os-sign-ios"
expected_workspace=f"workspaces/{project}/build/{'android' if lane=='android' else 'ios'}"
expected_output=(f"{expected_workspace}/app/build/outputs/bundle/release/app-release.aab" if lane=="android" else f"{expected_workspace}/build/SmartOS.xcarchive")
if exe != expected_exe or args[0] != expected_workspace or p.get("output_path") != expected_output:
    raise SystemExit("Signing job command/output failed allowlist validation")
for key,value in {
  "JOB_ID":job_id,"LANE":lane,"ADAPTER":expected_exe,"WORKSPACE":expected_workspace,"OUTPUT_PATH":expected_output
}.items(): print(f"{key}={shlex.quote(value)}")
PY
# shellcheck disable=SC1090
source "$TMP_DIR/job.env"

case "$ADAPTER" in
  smart-os-sign-android) ADAPTER_SCRIPT="scripts/signing/android-sign-and-bundle.sh" ;;
  smart-os-sign-ios) ADAPTER_SCRIPT="scripts/signing/ios-sign-and-archive.sh" ;;
  *) echo "Rejected non-allowlisted signing adapter" >&2; exit 4 ;;
esac

set +e
bash "$ADAPTER_SCRIPT" "$WORKSPACE" >"$TMP_DIR/adapter.out" 2>"$TMP_DIR/adapter.err"
ADAPTER_EXIT=$?
set -e

complete_failed(){
  local summary="$1"
  curl --fail-with-body --silent --show-error \
    -H 'Content-Type: application/json' \
    -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
    --data "$(python3 - "$RUNNER_ID" "$JOB_ID" "$summary" <<'PY'
import json,sys
print(json.dumps({"action":"complete-job","runnerId":sys.argv[1],"jobId":sys.argv[2],"result":"failed","resultSummary":sys.argv[3][:500]}))
PY
)" "$JOB_ENDPOINT" >/dev/null || true
}

if [[ $ADAPTER_EXIT -ne 0 ]]; then
  complete_failed "runner-local signing adapter failed with exit code $ADAPTER_EXIT"
  echo "Signing job $JOB_ID failed in local adapter (exit $ADAPTER_EXIT). Secret-bearing stderr was not uploaded." >&2
  exit "$ADAPTER_EXIT"
fi

if [[ "$LANE" == "android" ]]; then
  [[ -f "$OUTPUT_PATH" ]] || { complete_failed "expected Android AAB missing after adapter success"; echo "Expected AAB missing" >&2; exit 5; }
else
  [[ -d "$OUTPUT_PATH" ]] || { complete_failed "expected iOS XCArchive missing after adapter success"; echo "Expected XCArchive missing" >&2; exit 5; }
fi

read -r ARTIFACT_SHA ARTIFACT_SIZE < <(python3 - "$OUTPUT_PATH" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path(sys.argv[1])
h=hashlib.sha256(); size=0
if root.is_file():
    with root.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):
            h.update(chunk); size += len(chunk)
elif root.is_dir():
    for path in sorted((p for p in root.rglob('*') if p.is_file()), key=lambda p:p.relative_to(root).as_posix()):
        rel=path.relative_to(root).as_posix().encode()
        h.update(len(rel).to_bytes(8,'big')); h.update(rel)
        with path.open('rb') as f:
            for chunk in iter(lambda:f.read(1024*1024),b''):
                h.update(chunk); size += len(chunk)
else:
    raise SystemExit("Artifact path missing")
print("sha256:"+h.hexdigest(), size)
PY
)

COMPLETE_RESPONSE="$(curl --fail-with-body --silent --show-error \
  -H 'Content-Type: application/json' \
  -H "X-SmartOS-Runner-Token: $RUNNER_TOKEN" \
  --data "$(python3 - "$RUNNER_ID" "$JOB_ID" "$ARTIFACT_SHA" "$ARTIFACT_SIZE" <<'PY'
import json,sys
print(json.dumps({
  "action":"complete-job","runnerId":sys.argv[1],"jobId":sys.argv[2],"result":"succeeded",
  "artifactSha256":sys.argv[3],"artifactSizeBytes":int(sys.argv[4]),
  "resultSummary":"signed package produced and locally verified; publication not authorized"
}))
PY
)" "$JOB_ENDPOINT")"

python3 - "$COMPLETE_RESPONSE" <<'PY'
import json,sys
p=json.loads(sys.argv[1])
if p.get("status") != "succeeded": raise SystemExit(p.get("error","Signing completion was not accepted"))
print("Signing job completed")
print("jobId:", p["jobId"])
print("artifactSha256:", p["artifactSha256"])
print("artifactSizeBytes:", p["artifactSizeBytes"])
print("Store/production publishing remains locked.")
PY
