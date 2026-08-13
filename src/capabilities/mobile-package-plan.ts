import type { MobilePackagingStrategy } from "./mobile-strategy-types";

export interface MobilePackagePlan {
  strategy: MobilePackagingStrategy;
  targets: string[];
  requiresSigning: boolean;
  externalDistributionAllowed: false;
}

export function createMobilePackagePlan(strategy: MobilePackagingStrategy): MobilePackagePlan {
  if (strategy === "pwa") return { strategy, targets: ["web-build"], requiresSigning: false, externalDistributionAllowed: false };
  if (strategy === "android-twa" || strategy === "native-android") return { strategy, targets: ["android-project"], requiresSigning: true, externalDistributionAllowed: false };
  if (strategy === "native-ios") return { strategy, targets: ["ios-project"], requiresSigning: true, externalDistributionAllowed: false };
  return { strategy, targets: ["android-project", "ios-project"], requiresSigning: true, externalDistributionAllowed: false };
}
