#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:?App path required}"
EVIDENCE_DIR="${2:-.ci-evidence/ios-simulator}"
mkdir -p "$EVIDENCE_DIR"

UDID=$(python3 - <<'PY'
import json, subprocess
raw = subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '-j'])
data = json.loads(raw)
for _, devices in data.get('devices', {}).items():
    for device in devices:
        if device.get('isAvailable') and device.get('name', '').startswith('iPhone'):
            print(device['udid'])
            raise SystemExit(0)
raise SystemExit('No available iPhone Simulator')
PY
)

printf '%s\n' "$UDID" > "$EVIDENCE_DIR/udid.txt"
xcrun simctl boot "$UDID" || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl install "$UDID" "$APP_PATH"
xcrun simctl launch "$UDID" ai.smartos.snake | tee "$EVIDENCE_DIR/launch.txt"
sleep 3
xcrun simctl get_app_container "$UDID" ai.smartos.snake app > "$EVIDENCE_DIR/app-container.txt"
xcrun simctl io "$UDID" screenshot "$EVIDENCE_DIR/screenshot.png"
