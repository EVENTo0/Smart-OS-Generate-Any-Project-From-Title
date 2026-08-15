import type { MobilePackagingStrategy } from "./mobile-strategy-types";

export interface MobileStrategyProfile {
  id: MobilePackagingStrategy;
  platforms: string[];
  webFirst: boolean;
  nativePackage: boolean;
  nativeApiAccess: boolean;
}

export const mobileStrategyCatalog: MobileStrategyProfile[] = [
  { id: "pwa", platforms: ["web", "android", "ios"], webFirst: true, nativePackage: false, nativeApiAccess: false },
  { id: "capacitor", platforms: ["android", "ios"], webFirst: true, nativePackage: true, nativeApiAccess: true },
  { id: "android-twa", platforms: ["android"], webFirst: true, nativePackage: true, nativeApiAccess: false },
  { id: "native-android", platforms: ["android"], webFirst: false, nativePackage: true, nativeApiAccess: true },
  { id: "native-ios", platforms: ["ios"], webFirst: false, nativePackage: true, nativeApiAccess: true }
];
