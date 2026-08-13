import test from "node:test";
import assert from "node:assert/strict";
import { assessNativeToolchain } from "../src/execution/native-readiness";

test("iOS readiness requires macOS Xcode tools", () => {
  const blocked = assessNativeToolchain({ platform: "ios", hostPlatform: "linux", availableTools: ["xcodebuild", "simctl"] });
  assert.equal(blocked.runnable, false);
  const ready = assessNativeToolchain({ platform: "ios", hostPlatform: "macos", availableTools: ["xcodebuild", "simctl"] });
  assert.equal(ready.runnable, true);
});
