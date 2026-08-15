import type { PlatformLane } from "../execution/types";
import type { ReleaseCandidatePromotion } from "../release/promotion";

export type SigningLane = Extract<PlatformLane, "android" | "ios">;
export type SigningSecretProvider = "github-actions" | "external-vault" | "secure-local-runner";

export interface SigningSecretReference {
  name: string;
  provider: SigningSecretProvider;
}

export interface SecureSigningRequest {
  schemaVersion: "1";
  requestId: string;
  projectId: string;
  releaseCandidateId: string;
  version: string;
  candidateFingerprint: string;
  lane: SigningLane;
  runnerId: string;
  command: {
    executable: "smart-os-sign-android" | "smart-os-sign-ios";
    args: string[];
    workingDirectory: ".";
  };
  outputPath: string;
  secretRefs: SigningSecretReference[];
  policy: {
    browserCanResolveSecrets: false;
    serializeSecretValues: false;
    workspaceOnly: true;
    publicPublishAuthorized: false;
    storeUploadAuthorized: false;
  };
}

export interface SigningReadiness {
  ready: boolean;
  missingSecretRefs: string[];
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
}

const SAFE_ID = /^[A-Za-z0-9._:-]+$/;

function requiredSecretNames(lane: SigningLane): string[] {
  return lane === "android"
    ? [
        "ANDROID_UPLOAD_KEYSTORE",
        "ANDROID_UPLOAD_KEYSTORE_PASSWORD",
        "ANDROID_UPLOAD_KEY_ALIAS",
        "ANDROID_UPLOAD_KEY_PASSWORD",
      ]
    : [
        "APPLE_DEVELOPMENT_TEAM_ID",
        "APPLE_SIGNING_CERTIFICATE",
        "APPLE_SIGNING_CERTIFICATE_PASSWORD",
        "APPLE_PROVISIONING_PROFILE",
      ];
}

function commandFor(lane: SigningLane, projectId: string) {
  const workspace = `workspaces/${projectId}/build`;
  if (lane === "android") {
    return {
      executable: "smart-os-sign-android" as const,
      args: [`${workspace}/android`],
      workingDirectory: "." as const,
      outputPath: `${workspace}/android/app/build/outputs/bundle/release/app-release.aab`,
    };
  }
  return {
    executable: "smart-os-sign-ios" as const,
    args: [`${workspace}/ios`],
    workingDirectory: "." as const,
    outputPath: `${workspace}/ios/build/SmartOS.xcarchive`,
  };
}

export function createSecureSigningRequest(input: {
  requestId: string;
  promotion: ReleaseCandidatePromotion;
  lane: SigningLane;
  runnerId: string;
  provider: SigningSecretProvider;
}): SecureSigningRequest {
  if (!SAFE_ID.test(input.requestId)) throw new Error("Unsafe signing request id");
  if (!SAFE_ID.test(input.runnerId)) throw new Error("Unsafe signing runner id");
  if (input.promotion.publicPublishAuthorized !== false) {
    throw new Error("Signing requires a non-publishing release candidate");
  }
  if (!input.promotion.targetLanes.includes(input.lane)) {
    throw new Error(`Signing lane ${input.lane} is outside the approved release candidate scope`);
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.promotion.candidateFingerprint)) {
    throw new Error("Signing requires a valid release candidate fingerprint");
  }

  const command = commandFor(input.lane, input.promotion.projectId);
  return {
    schemaVersion: "1",
    requestId: input.requestId,
    projectId: input.promotion.projectId,
    releaseCandidateId: input.promotion.releaseCandidateId,
    version: input.promotion.version,
    candidateFingerprint: input.promotion.candidateFingerprint,
    lane: input.lane,
    runnerId: input.runnerId,
    command: {
      executable: command.executable,
      args: command.args,
      workingDirectory: command.workingDirectory,
    },
    outputPath: command.outputPath,
    secretRefs: requiredSecretNames(input.lane).map((name) => ({ name, provider: input.provider })),
    policy: {
      browserCanResolveSecrets: false,
      serializeSecretValues: false,
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    },
  };
}

export function evaluateSigningReadiness(
  request: SecureSigningRequest,
  availableSecretRefs: string[],
): SigningReadiness {
  const available = new Set(availableSecretRefs);
  const missingSecretRefs = request.secretRefs
    .map((ref) => ref.name)
    .filter((name) => !available.has(name));
  return {
    ready: missingSecretRefs.length === 0,
    missingSecretRefs,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  };
}
