import test from "node:test";
import assert from "node:assert/strict";
import { assessNativeToolchain } from "../src/execution/native-readiness";
import { requireTargetEvidence } from "../src/release/native-evidence";

test("iOS readiness requires macOS Xcode tools", () => {
  const blocked = assessNativeToolchain({ platform: "ios", hostPlatform: "linux", availableTools: ["xcodebuild", "simctl"] });
  assert.equal(blocked.runnable, false);
  const ready = assessNativeToolchain({ platform: "ios", hostPlatform: "macos", availableTools: ["xcodebuild", "simctl"] });
  assert.equal(ready.runnable, true);
});

test("iOS release target is blocked until Simulator runtime evidence exists", () => {
  const base = { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true as const };
  const result = requireTargetEvidence(base, ["ios"], [{
    projectId: "snake-game",
    platform: "ios",
    runId: "2",
    commitSha: "abc",
    buildPassed: true,
    runtimePassed: false,
    artifacts: [{ id: "app", name: "snake-ios-simulator-app" }],
  }]);
  assert.equal(result.readyForCandidate, false);
  assert.ok(result.blockers.includes("ios runtime not verified"));
  assert.ok(result.blockers.includes("ios runtime evidence artifact missing"));
});
