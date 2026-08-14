import test from "node:test";
import assert from "node:assert/strict";
import { createRunnerProfile } from "../src/execution/runner-profiles";

test("runner profile records only observed capabilities", () => {
  const profile = createRunnerProfile({
    runnerId: "local-codex",
    runnerKind: "codex",
    hostPlatform: "linux",
    availableTools: ["node", "npm"],
    lanes: ["web"],
    local: true,
  });

  assert.equal(profile.workspaceOnly, true);
  assert.deepEqual(profile.availableTools, ["node", "npm"]);
  assert.deepEqual(profile.nativePlatforms, []);
  assert.equal(profile.allowsSecrets, false);
  assert.equal(profile.allowsPublicPublish, false);
});

test("iOS runner profile requires macOS", () => {
  assert.throws(() => createRunnerProfile({
    runnerId: "bad-ios",
    runnerKind: "custom",
    hostPlatform: "linux",
    availableTools: ["xcodebuild", "simctl"],
    lanes: ["ios"],
    nativePlatforms: ["ios"],
  }), /macOS/);
});
