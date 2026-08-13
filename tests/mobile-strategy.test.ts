import test from "node:test";
import assert from "node:assert/strict";
import { rankMobileStrategies } from "../src/capabilities/mobile-strategy-score";

test("web-first Android and iOS store project prefers Capacitor profile", () => {
  const ranked = rankMobileStrategies({
    targetPlatforms: ["android", "ios"],
    webFirst: true,
    requiresNativeApis: true,
    requiresStorePackage: true,
  });
  assert.equal(ranked[0].id, "capacitor");
});
