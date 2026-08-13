#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:?App path required}"
EVIDENCE_DIR="${2:-.ci-evidence/ios-simulator}"
mkdir -p "$EVIDENCE_DIR"

UDID=$(python3 - <<'PY'
import json, re, subprocess
raw = subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j'])
data = json.loads(raw)
candidates = []
for runtime, devices in data.get('devices', {}).items():
    nums = tuple(int(x) for x in re.findall(r'\d+', runtime))
    for device in devices:
        if device.get('isAvailable') and device.get('name', '').startswith('iPhone'):
            candidates.append((nums, device.get('state') == 'Booted', device['udid']))
if not candidates:
    raise SystemExit('No available iPhone Simulator')
candidates.sort(reverse=True)
print(candidates[0][2])
PY
)

printf '%s\n' "$UDID" > "$EVIDENCE_DIR/udid.txt"
xcrun simctl shutdown all || true
xcrun simctl boot "$UDID"
python3 - "$UDID" <<'PY'
import subprocess, sys
udid = sys.argv[1]
subprocess.run(['xcrun', 'simctl', 'bootstatus', udid, '-b'], check=True, timeout=120)
PY
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" ai.smartos.snake | tee "$EVIDENCE_DIR/launch.txt"
sleep 3
xcrun simctl get_app_container "$UDID" ai.smartos.snake app > "$EVIDENCE_DIR/app-container.txt"
xcrun simctl io "$UDID" screenshot "$EVIDENCE_DIR/screenshot.png"
