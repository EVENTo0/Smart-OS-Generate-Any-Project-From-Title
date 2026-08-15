import type { SigningLane, SigningSecretProvider } from "./secure-signing-broker";

export type SigningProviderVerification = "verified" | "unverified" | "access-denied";
export type SigningRunnerState = "available" | "blocked" | "awaiting-registration" | "unavailable";

export interface SigningProviderRegistration {
  handleId: string;
  provider: SigningSecretProvider;
  lane: SigningLane;
  requiredSecretRefs: string[];
  verification: SigningProviderVerification;
  exposesSecretValues: false;
}

export interface SigningRunnerRegistration {
  runnerId: string;
  lane: SigningLane;
  hostPlatform: "linux" | "macos" | "windows";
  tools: string[];
  state: SigningRunnerState;
  blocker?: {
    category: "billing" | "credentials" | "toolchain" | "runner-unavailable" | "unknown-infrastructure";
    message: string;
  };
  workspaceOnly: true;
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
}

export interface SigningEnvironmentSelection {
  lane: SigningLane;
  ready: boolean;
  providerHandleId?: string;
  runnerId?: string;
  blockers: string[];
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
}

export function selectSigningEnvironment(input: {
  lane: SigningLane;
  providers: SigningProviderRegistration[];
  runners: SigningRunnerRegistration[];
}): SigningEnvironmentSelection {
  const providers = input.providers.filter((provider) => provider.lane === input.lane);
  const runners = input.runners.filter((runner) => runner.lane === input.lane);
  const verifiedProvider = providers.find((provider) => provider.verification === "verified");
  const eligibleRunner = runners.find((runner) => {
    if (runner.state !== "available") return false;
    if (input.lane === "ios" && runner.hostPlatform !== "macos") return false;
    if (input.lane === "android" && !runner.tools.some((tool) => /gradle/i.test(tool))) return false;
    if (input.lane === "ios" && !runner.tools.some((tool) => /xcodebuild/i.test(tool))) return false;
    return true;
  });

  const blockers: string[] = [];
  if (!verifiedProvider) {
    const denied = providers.some((provider) => provider.verification === "access-denied");
    blockers.push(denied ? "signing-secret-references-cannot-be-verified" : "signing-provider-not-verified");
  }
  if (!eligibleRunner) {
    const runnerBlockers = runners
      .filter((runner) => runner.state === "blocked" && runner.blocker)
      .map((runner) => `${runner.runnerId}:${runner.blocker!.category}`);
    blockers.push(...(runnerBlockers.length ? runnerBlockers : ["eligible-signing-runner-unavailable"]));
  }

  return {
    lane: input.lane,
    ready: Boolean(verifiedProvider && eligibleRunner),
    providerHandleId: verifiedProvider?.handleId,
    runnerId: eligibleRunner?.runnerId,
    blockers,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  };
}
