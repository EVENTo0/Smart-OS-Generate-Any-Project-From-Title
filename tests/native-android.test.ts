import test from "node:test";
import assert from "node:assert/strict";
import { assessNativeToolchain } from "../src/execution/native-readiness";

test("Android readiness requires SDK tools", () => {
  const ready = assessNativeToolchain({ platform: "android", hostPlatform: "linux", availableTools: ["gradle-wrapper", "sdkmanager", "adb"] });
  assert.equal(ready.runnable, true);
  const blocked = assessNativeToolchain({ platform: "android", hostPlatform: "linux", availableTools: ["gradle-wrapper"] });
  assert.equal(blocked.runnable, false);
});
