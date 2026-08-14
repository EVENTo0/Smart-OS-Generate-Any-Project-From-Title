import type { PlatformLane } from "../execution/types";
import type { ReleaseCandidatePromotion } from "./promotion";

export type StorePackageKind = "android-aab" | "ios-archive";

export interface StorePackagingCommand {
  executable: string;
  args: string[];
  workingDirectory: string;
  requiredSecretRefs: string[];
}

export interface StorePackageTarget {
  lane: Extract<PlatformLane, "android" | "ios">;
  kind: StorePackageKind;
  outputPath: string;
  command: StorePackagingCommand;
  signingRequiredForStoreUpload: true;
  signingAvailable: boolean;
  signingBlockers: string[];
}

export interface StorePackagingPlan {
  schemaVersion: "1";
  projectId: string;
  releaseCandidateId: string;
  version: string;
  candidateFingerprint: string;
  targets: StorePackageTarget[];
  packageExecutionAuthorized: boolean;
  publicPublishAuthorized: false;
}

function androidTarget(workspaceRoot: string, availableSecretRefs: Set<string>): StorePackageTarget {
  const requiredSecretRefs = [
    "ANDROID_UPLOAD_KEYSTORE",
    "ANDROID_UPLOAD_KEYSTORE_PASSWORD",
    "ANDROID_UPLOAD_KEY_ALIAS",
    "ANDROID_UPLOAD_KEY_PASSWORD",
  ];
  const missing = requiredSecretRefs.filter((ref) => !availableSecretRefs.has(ref));
  return {
    lane: "android",
    kind: "android-aab",
    outputPath: `${workspaceRoot}/android/app/build/outputs/bundle/release/app-release.aab`,
    command: {
      executable: "./gradlew",
      args: ["bundleRelease"],
      workingDirectory: `${workspaceRoot}/android`,
      requiredSecretRefs,
    },
    signingRequiredForStoreUpload: true,
    signingAvailable: missing.length === 0,
    signingBlockers: missing.map((ref) => `missing signing secret reference: ${ref}`),
  };
}

function iosTarget(workspaceRoot: string, availableSecretRefs: Set<string>): StorePackageTarget {
  const requiredSecretRefs = [
    "APPLE_DEVELOPMENT_TEAM_ID",
    "APPLE_SIGNING_CERTIFICATE",
    "APPLE_PROVISIONING_PROFILE",
  ];
  const missing = requiredSecretRefs.filter((ref) => !availableSecretRefs.has(ref));
  return {
    lane: "ios",
    kind: "ios-archive",
    outputPath: `${workspaceRoot}/ios/build/SmartOS.xcarchive`,
    command: {
      executable: "xcodebuild",
      args: [
        "-workspace", "App/App.xcworkspace",
        "-scheme", "App",
        "-configuration", "Release",
        "-archivePath", "build/SmartOS.xcarchive",
        "archive",
      ],
      workingDirectory: `${workspaceRoot}/ios`,
      requiredSecretRefs,
    },
    signingRequiredForStoreUpload: true,
    signingAvailable: missing.length === 0,
    signingBlockers: missing.map((ref) => `missing signing secret reference: ${ref}`),
  };
}

export function createStorePackagingPlan(input: {
  promotion: ReleaseCandidatePromotion;
  workspaceRoot: string;
  targetLanes: PlatformLane[];
  availableSecretRefs?: string[];
}): StorePackagingPlan {
  if (!input.workspaceRoot || input.workspaceRoot.includes("..")) throw new Error("Unsafe workspace root");
  if (input.promotion.publicPublishAuthorized !== false) throw new Error("Promotion must not authorize public publishing");
  const targets = new Set(input.targetLanes);
  const available = new Set(input.availableSecretRefs ?? []);
  const packageTargets: StorePackageTarget[] = [];
  if (targets.has("android")) packageTargets.push(androidTarget(input.workspaceRoot, available));
  if (targets.has("ios")) packageTargets.push(iosTarget(input.workspaceRoot, available));
  if (!packageTargets.length) throw new Error("Store packaging requires Android and/or iOS target lane");

  return {
    schemaVersion: "1",
    projectId: input.promotion.projectId,
    releaseCandidateId: input.promotion.releaseCandidateId,
    version: input.promotion.version,
    candidateFingerprint: input.promotion.candidateFingerprint,
    targets: packageTargets,
    packageExecutionAuthorized: true,
    publicPublishAuthorized: false,
  };
}
