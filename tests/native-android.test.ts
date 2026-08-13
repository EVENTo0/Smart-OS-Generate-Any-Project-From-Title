import test from "node:test";
import assert from "node:assert/strict";
import { assessNativeToolchain } from "../src/execution/native-readiness";
import { requireTargetEvidence } from "../src/release/native-evidence";

test("Android readiness requires SDK tools", () => {
  const ready = assessNativeToolchain({ platform: "android", hostPlatform: "linux", availableTools: ["gradle-wrapper", "sdkmanager", "adb"] });
  assert.equal(ready.runnable, true);
  const blocked = assessNativeToolchain({ platform: "android", hostPlatform: "linux", availableTools: ["gradle-wrapper"] });
  assert.equal(blocked.runnable, false);
});

test("Android release target requires package and runtime artifacts", () => {
  const base = { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true as const };
  const result = requireTargetEvidence(base, ["android"], [{
    projectId: "snake-game",
    platform: "android",
    runId: "1",
    commitSha: "abc",
    buildPassed: true,
    runtimePassed: true,
    artifacts: [
      { id: "apk", name: "snake-android-debug-apk" },
      { id: "runtime", name: "snake-android-emulator-evidence" },
    ],
  }]);
  assert.equal(result.readyForCandidate, true);
  assert.deepEqual(result.blockers, []);
});
