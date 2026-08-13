import type { MobilePackagingStrategy } from "../capabilities/mobile-strategy-types";
import { assessNativeToolchain } from "./native-readiness";
import type { NativePlatform, NativeToolchainProbe } from "./native-types";

export interface NativeRunnerRoute {
  platform: NativePlatform;
  runnerClass: "android-sdk-runner" | "macos-xcode-runner";
  buildRunnable: boolean;
  simulatorOrEmulatorRunnable: boolean;
  blockers: string[];
}

function targetsFor(strategy: MobilePackagingStrategy): NativePlatform[] {
  if (strategy === "capacitor") return ["android", "ios"];
  if (strategy === "android-twa" || strategy === "native-android") return ["android"];
  if (strategy === "native-ios") return ["ios"];
  return [];
}

export function routeNativeRunners(strategy: MobilePackagingStrategy, probes: NativeToolchainProbe[]): NativeRunnerRoute[] {
  return targetsFor(strategy).map((platform) => {
    const probe = probes.find((item) => item.platform === platform);
    if (!probe) {
      return {
        platform,
        runnerClass: platform === "android" ? "android-sdk-runner" : "macos-xcode-runner",
        buildRunnable: false,
        simulatorOrEmulatorRunnable: false,
        blockers: [`${platform} runner probe missing`],
      };
    }

    const readiness = assessNativeToolchain(probe);
    const runtimeTools = platform === "android" ? ["emulator", "avdmanager"] : ["simctl"];
    const runtimeBlockers = runtimeTools
      .filter((tool) => !probe.availableTools.includes(tool))
      .map((tool) => `missing runtime tool: ${tool}`);

    return {
      platform,
      runnerClass: platform === "android" ? "android-sdk-runner" : "macos-xcode-runner",
      buildRunnable: readiness.runnable,
      simulatorOrEmulatorRunnable: readiness.runnable && runtimeBlockers.length === 0,
      blockers: [...readiness.blockers, ...runtimeBlockers],
    };
  });
}
