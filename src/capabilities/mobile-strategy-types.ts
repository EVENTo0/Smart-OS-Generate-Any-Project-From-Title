export type MobilePackagingStrategy = "pwa" | "capacitor" | "android-twa" | "native-android" | "native-ios";

export interface MobileStrategyInput {
  targetPlatforms: string[];
  webFirst: boolean;
  requiresNativeApis: boolean;
  requiresStorePackage: boolean;
}

export interface MobileStrategyDecision {
  primary: MobilePackagingStrategy;
  alternatives: MobilePackagingStrategy[];
  rationale: string[];
  blockers: string[];
}
