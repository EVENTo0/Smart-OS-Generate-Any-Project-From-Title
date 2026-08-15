import type { PlatformLane } from "./types";
import type { InfrastructureBlocker } from "./infrastructure-blocker";
import type { NativePlatform } from "./native-types";

export type RunnerKind = "github-actions" | "local-shell" | "codex" | "claude-code" | "antigravity" | "custom";
export type RunnerAvailability = "available" | "blocked" | "unavailable";

export interface RunnerCapabilityAdvertisement {
  runnerId: string;
  hostPlatform: string;
  workspaceOnly: true;
  nativePlatforms: NativePlatform[];
  availableTools: string[];
  allowsSecrets: false;
  allowsPublicPublish: false;
  runnerKind?: RunnerKind;
  lanes?: PlatformLane[];
  local?: boolean;
  availability?: RunnerAvailability;
  blocker?: InfrastructureBlocker;
  quality?: number;
  cost?: number;
  latency?: number;
  privacy?: number;
  estimatedCostUnits?: number;
  estimatedLatencyMs?: number;
}

export function supportsNativePlatform(advertisement: RunnerCapabilityAdvertisement, platform: NativePlatform): boolean {
  return advertisement.workspaceOnly && advertisement.nativePlatforms.includes(platform);
}

export function supportsLane(advertisement: RunnerCapabilityAdvertisement, lane: PlatformLane): boolean {
  if (advertisement.lanes?.includes(lane)) return true;
  if (lane === "android" || lane === "ios") return advertisement.nativePlatforms.includes(lane);
  return false;
}
