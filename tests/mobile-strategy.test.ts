import test from "node:test";
import assert from "node:assert/strict";
import { rankMobileStrategies } from "../src/capabilities/mobile-strategy-score";
import { createMobilePackageStage } from "../src/capabilities/mobile-package-stage";

test("web-first Android and iOS store project prefers Capacitor profile", () => {
  const ranked = rankMobileStrategies({
    targetPlatforms: ["android", "ios"],
    webFirst: true,
    requiresNativeApis: true,
    requiresStorePackage: true,
  });
  assert.equal(ranked[0].id, "capacitor");
});

test("mobile package stage keeps distribution disabled", () => {
  const stage = createMobilePackageStage({ targetPlatforms: ["android", "ios"], webFirst: true, requiresNativeApis: false, requiresStorePackage: true });
  assert.equal(stage.decision.primary, "capacitor");
  assert.equal(stage.plan.externalDistributionAllowed, false);
});
