import type { NativePlatform } from "./native-types";

export interface RunnerCapabilityAdvertisement {
  runnerId: string;
  hostPlatform: string;
  workspaceOnly: true;
  nativePlatforms: NativePlatform[];
  availableTools: string[];
  allowsSecrets: false;
  allowsPublicPublish: false;
}

export function supportsNativePlatform(advertisement: RunnerCapabilityAdvertisement, platform: NativePlatform): boolean {
  return advertisement.workspaceOnly && advertisement.nativePlatforms.includes(platform);
}
