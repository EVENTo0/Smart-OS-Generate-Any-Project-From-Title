import test from "node:test";
import assert from "node:assert/strict";
import { routeExecutionRunner } from "../src/execution/runner-broker";

test("iOS routing requires a macOS runner", () => {
  const decision = routeExecutionRunner({ lane: "ios", requiredTools: ["xcodebuild", "simctl"] }, [
    {
      runnerId: "linux-ios-advertisement",
      hostPlatform: "linux",
      workspaceOnly: true,
      nativePlatforms: ["ios"],
      lanes: ["ios"],
      availableTools: ["xcodebuild", "simctl"],
      allowsSecrets: false,
      allowsPublicPublish: false,
    },
    {
      runnerId: "macos-xcode",
      hostPlatform: "macos",
      workspaceOnly: true,
      nativePlatforms: ["ios"],
      lanes: ["ios"],
      availableTools: ["xcodebuild", "simctl"],
      allowsSecrets: false,
      allowsPublicPublish: false,
    },
  ]);

  assert.equal(decision.selectedRunnerId, "macos-xcode");
});
