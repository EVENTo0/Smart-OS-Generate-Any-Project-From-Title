export type NativePlatform = "android" | "ios";

export interface NativeToolchainProbe {
  platform: NativePlatform;
  hostPlatform: string;
  availableTools: string[];
}

export interface NativeToolchainReadiness {
  platform: NativePlatform;
  runnable: boolean;
  blockers: string[];
}
