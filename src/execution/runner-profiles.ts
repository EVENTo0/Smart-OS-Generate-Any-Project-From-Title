import type { PlatformLane } from "./types";
import type { InfrastructureBlocker } from "./infrastructure-blocker";
import type { NativePlatform } from "./native-types";
import type { RunnerAvailability, RunnerCapabilityAdvertisement, RunnerKind } from "./runner-capability";

export interface RunnerProfileInput {
  runnerId: string;
  runnerKind: RunnerKind;
  hostPlatform: string;
  availableTools: string[];
  lanes: PlatformLane[];
  nativePlatforms?: NativePlatform[];
  local?: boolean;
  availability?: RunnerAvailability;
  blocker?: InfrastructureBlocker;
  quality?: number;
  cost?: number;
  latency?: number;
  privacy?: number;
}

export function createRunnerProfile(input: RunnerProfileInput): RunnerCapabilityAdvertisement {
  const nativePlatforms = [...new Set(input.nativePlatforms ?? [])];
  const lanes = [...new Set(input.lanes)];
  const availableTools = [...new Set(input.availableTools)].sort();

  if (nativePlatforms.includes("ios") && input.hostPlatform !== "macos") {
    throw new Error("iOS runner profiles require a macOS host");
  }
  if (input.availability === "blocked" && !input.blocker) {
    throw new Error("Blocked runner profiles require an infrastructure blocker");
  }
  if (input.blocker && input.availability !== "blocked") {
    throw new Error("Infrastructure blocker requires blocked availability");
  }

  return {
    runnerId: input.runnerId,
    runnerKind: input.runnerKind,
    hostPlatform: input.hostPlatform,
    workspaceOnly: true,
    nativePlatforms,
    availableTools,
    allowsSecrets: false,
    allowsPublicPublish: false,
    lanes,
    local: input.local ?? input.runnerKind === "local-shell",
    availability: input.availability ?? "available",
    blocker: input.blocker,
    quality: input.quality,
    cost: input.cost,
    latency: input.latency,
    privacy: input.privacy,
  };
}
