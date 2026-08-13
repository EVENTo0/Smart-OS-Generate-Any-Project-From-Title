import test from "node:test";
import assert from "node:assert/strict";
import { createMobilePackagingManifest } from "../src/capabilities/mobile-packaging-manifest";

test("Snake web-first mobile packaging prefers Capacitor and gates native runners", () => {
  const manifest = createMobilePackagingManifest(
    "snake-game",
    {
      targetPlatforms: ["web", "android", "ios"],
      webFirst: true,
      requiresNativeApis: false,
      requiresStorePackage: true,
    },
    [
      {
        platform: "android",
        hostPlatform: "linux",
        availableTools: ["gradle-wrapper", "sdkmanager", "adb", "emulator", "avdmanager"],
      },
      {
        platform: "ios",
        hostPlatform: "linux",
        availableTools: ["xcodebuild", "simctl"],
      },
    ],
  );

  assert.equal(manifest.decision.primary, "capacitor");
  const android = manifest.nativeRoutes.find((route) => route.platform === "android");
  const ios = manifest.nativeRoutes.find((route) => route.platform === "ios");
  assert.equal(android?.buildRunnable, true);
  assert.equal(android?.simulatorOrEmulatorRunnable, true);
  assert.equal(ios?.buildRunnable, false);
  assert.equal(manifest.packageReady, false);
  assert.equal(manifest.storePublicationByDefault, false);
});

test("iOS packaging becomes runnable only on a macOS Xcode runner", () => {
  const manifest = createMobilePackagingManifest(
    "snake-game",
    {
      targetPlatforms: ["ios"],
      webFirst: false,
      requiresNativeApis: true,
      requiresStorePackage: true,
    },
    [{ platform: "ios", hostPlatform: "macos", availableTools: ["xcodebuild", "simctl"] }],
  );
  assert.equal(manifest.decision.primary, "native-ios");
  assert.equal(manifest.nativeRoutes[0].buildRunnable, true);
  assert.equal(manifest.nativeRoutes[0].simulatorOrEmulatorRunnable, true);
});
