import type { SigningLane, SigningSecretProvider, SecureSigningRequest } from "./secure-signing-broker";
import { evaluateSigningReadiness } from "./secure-signing-broker";

export interface SigningSecretCatalog {
  provider: SigningSecretProvider;
  availableRefs: string[];
  exposesSecretValues: false;
}

export interface SigningRunnerAdvertisement {
  runnerId: string;
  hostPlatform: "linux" | "macos" | "windows";
  lanes: SigningLane[];
  tools: string[];
  secretProviders: SigningSecretProvider[];
  workspaceOnly: true;
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
}

export interface SigningExecutionPreflight {
  ready: boolean;
  lane: SigningLane;
  runnerId: string;
  provider: SigningSecretProvider;
  missingSecretRefs: string[];
  blockers: string[];
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
}

function requiredTools(lane: SigningLane): string[] {
  return lane === "android" ? ["gradle", "jarsigner"] : ["xcodebuild", "security"];
}

export function evaluateSigningExecutionPreflight(input: {
  request: SecureSigningRequest;
  runner: SigningRunnerAdvertisement;
  secretCatalog: SigningSecretCatalog;
}): SigningExecutionPreflight {
  const { request, runner, secretCatalog } = input;
  const blockers: string[] = [];

  if (runner.runnerId !== request.runnerId) blockers.push("runner-id-mismatch");
  if (!runner.lanes.includes(request.lane)) blockers.push("runner-lane-unsupported");
  if (request.lane === "ios" && runner.hostPlatform !== "macos") blockers.push("ios-requires-macos");

  for (const tool of requiredTools(request.lane)) {
    if (!runner.tools.includes(tool) && !(tool === "gradle" && runner.tools.includes("./gradlew"))) {
      blockers.push(`missing-tool:${tool}`);
    }
  }

  const requestProviders = [...new Set(request.secretRefs.map((ref) => ref.provider))];
  if (requestProviders.length !== 1 || requestProviders[0] !== secretCatalog.provider) {
    blockers.push("secret-provider-mismatch");
  }
  if (!runner.secretProviders.includes(secretCatalog.provider)) blockers.push("runner-secret-provider-unsupported");
  if (secretCatalog.exposesSecretValues !== false) blockers.push("secret-catalog-must-not-expose-values");
  if (!runner.workspaceOnly) blockers.push("runner-must-be-workspace-only");
  if (runner.publicPublishAuthorized !== false) blockers.push("runner-public-publish-must-be-disabled");
  if (runner.storeUploadAuthorized !== false) blockers.push("runner-store-upload-must-be-disabled");

  const readiness = evaluateSigningReadiness(request, secretCatalog.availableRefs);
  if (!readiness.ready) blockers.push("missing-signing-secret-references");

  return {
    ready: blockers.length === 0 && readiness.ready,
    lane: request.lane,
    runnerId: runner.runnerId,
    provider: secretCatalog.provider,
    missingSecretRefs: readiness.missingSecretRefs,
    blockers: [...new Set(blockers)],
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  };
}
