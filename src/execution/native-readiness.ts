import type { NativeToolchainProbe, NativeToolchainReadiness } from "./native-types";

const REQUIRED: Record<NativeToolchainProbe["platform"], string[]> = {
  android: ["gradle-wrapper", "sdkmanager", "adb"],
  ios: ["xcodebuild", "simctl"],
};

export function assessNativeToolchain(probe: NativeToolchainProbe): NativeToolchainReadiness {
  const blockers: string[] = [];
  if (probe.platform === "ios" && probe.hostPlatform !== "macos") blockers.push("macOS host required");
  for (const tool of REQUIRED[probe.platform]) {
    if (!probe.availableTools.includes(tool)) blockers.push(`missing required tool: ${tool}`);
  }
  return { platform: probe.platform, runnable: blockers.length === 0, blockers };
}
