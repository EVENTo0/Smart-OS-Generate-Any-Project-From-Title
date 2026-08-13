import { mobileStrategyCatalog } from "./mobile-strategy-catalog";
import type { MobilePackagingStrategy, MobileStrategyDecision, MobileStrategyInput } from "./mobile-strategy-types";

function has(platforms: string[], name: string): boolean {
  return platforms.some((platform) => platform.toLowerCase() === name);
}

function available(id: MobilePackagingStrategy): boolean {
  return mobileStrategyCatalog.some((profile) => profile.id === id);
}

export function selectMobileStrategy(input: MobileStrategyInput): MobileStrategyDecision {
  const android = has(input.targetPlatforms, "android");
  const ios = has(input.targetPlatforms, "ios") || has(input.targetPlatforms, "iphone") || has(input.targetPlatforms, "ipad");
  const rationale: string[] = [];
  const blockers: string[] = [];
  let primary: MobilePackagingStrategy;
  let alternatives: MobilePackagingStrategy[] = [];

  if (!android && !ios) {
    primary = "pwa";
    rationale.push("no native mobile target requested; keep the web-first deliverable");
  } else if (input.webFirst && android && ios && input.requiresStorePackage) {
    primary = "capacitor";
    alternatives = ["pwa", "native-android", "native-ios"];
    rationale.push("shared web-first codebase targets Android and iOS with native packages");
    rationale.push("one packaging lane reduces duplicate implementation work while preserving native bridge access");
  } else if (input.webFirst && android && !ios && input.requiresStorePackage && !input.requiresNativeApis) {
    primary = "android-twa";
    alternatives = ["capacitor", "pwa", "native-android"];
    rationale.push("Android-only web-first project can use a lightweight store package without a native bridge");
  } else if (input.webFirst) {
    primary = input.requiresStorePackage ? "capacitor" : "pwa";
    alternatives = input.requiresStorePackage ? ["pwa"] : ["capacitor"];
    rationale.push(input.requiresStorePackage ? "native package requested for a web-first project" : "no native package required");
  } else if (android && !ios) {
    primary = "native-android";
    alternatives = input.requiresNativeApis ? [] : ["capacitor"];
    rationale.push("project is Android-focused and not web-first");
  } else if (ios && !android) {
    primary = "native-ios";
    alternatives = input.requiresNativeApis ? [] : ["capacitor"];
    rationale.push("project is iOS-focused and not web-first");
  } else {
    primary = "capacitor";
    alternatives = ["native-android", "native-ios"];
    rationale.push("cross-platform mobile target benefits from a shared package lane unless native-only requirements dominate");
  }

  if (!available(primary)) blockers.push(`mobile strategy is not registered: ${primary}`);
  return { primary, alternatives: alternatives.filter(available), rationale, blockers };
}
