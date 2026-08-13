#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:?App path required}"
EVIDENCE_DIR="${2:-.ci-evidence/ios-simulator}"
mkdir -p "$EVIDENCE_DIR"

UDID=$(python3 - <<'PY'
import json, re, subprocess
raw = subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j'], timeout=20)
data = json.loads(raw)
candidates = []
for runtime, devices in data.get('devices', {}).items():
    nums = tuple(int(x) for x in re.findall(r'\d+', runtime))
    for device in devices:
        if device.get('isAvailable') and device.get('name', '').startswith('iPhone'):
            candidates.append((device.get('state') == 'Booted', nums, device['udid']))
if not candidates:
    raise SystemExit('No available iPhone Simulator')
candidates.sort(reverse=True)
print(candidates[0][2])
PY
)

printf '%s\n' "$UDID" > "$EVIDENCE_DIR/udid.txt"
python3 - "$UDID" <<'PY'
import subprocess, sys
udid = sys.argv[1]
subprocess.run(['xcrun', 'simctl', 'boot', udid], check=False, timeout=30)
subprocess.run(['xcrun', 'simctl', 'bootstatus', udid, '-b'], check=True, timeout=120)
PY
python3 - "$UDID" "$APP_PATH" <<'PY'
import subprocess, sys
udid, app = sys.argv[1], sys.argv[2]
subprocess.run(['xcrun', 'simctl', 'install', udid, app], check=True, timeout=60)
PY
xcrun simctl launch "$UDID" ai.smartos.snake | tee "$EVIDENCE_DIR/launch.txt"
sleep 3
xcrun simctl get_app_container "$UDID" ai.smartos.snake app > "$EVIDENCE_DIR/app-container.txt"
xcrun simctl io "$UDID" screenshot "$EVIDENCE_DIR/screenshot.png"
