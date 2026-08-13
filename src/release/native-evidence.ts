import type { ExecutionResult, PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "./artifact-registry";
import type { ReleaseReadiness } from "./readiness";

export interface NativeArtifactSnapshot {
  id: string;
  name: string;
  digest?: string;
}

export interface NativeVerificationSnapshot {
  projectId: string;
  platform: "android" | "ios";
  runId: string;
  commitSha: string;
  buildPassed: boolean;
  runtimePassed: boolean;
  artifacts: NativeArtifactSnapshot[];
}

const expectedArtifacts = {
  android: { packageName: "snake-android-debug-apk", runtimeName: "snake-android-emulator-evidence" },
  ios: { packageName: "snake-ios-simulator-app", runtimeName: "snake-ios-simulator-evidence" },
} as const;

export function nativeExecutionResults(snapshot: NativeVerificationSnapshot): ExecutionResult[] {
  const lane = snapshot.platform;
  return [
    {
      commandId: `${lane}-package`,
      status: snapshot.buildPassed ? "passed" : "failed",
      logRefs: [`github-actions/run/${snapshot.runId}/${lane}-build`],
      artifactRefs: snapshot.artifacts.filter((a) => a.name === expectedArtifacts[lane].packageName).map((a) => a.id),
      fixCapabilityId: snapshot.buildPassed ? undefined : `${lane}-build-engineer`,
    },
    {
      commandId: `${lane}-runtime`,
      status: snapshot.runtimePassed ? "passed" : "failed",
      logRefs: [`github-actions/run/${snapshot.runId}/${lane}-runtime`],
      artifactRefs: snapshot.artifacts.filter((a) => a.name === expectedArtifacts[lane].runtimeName).map((a) => a.id),
      fixCapabilityId: snapshot.runtimePassed ? undefined : `${lane}-runtime-engineer`,
    },
  ];
}

export function nativeArtifactRecords(snapshot: NativeVerificationSnapshot): ArtifactRecord[] {
  return snapshot.artifacts.map((artifact) => ({
    id: `github-actions-${artifact.id}`,
    projectId: snapshot.projectId,
    kind: artifact.name === expectedArtifacts[snapshot.platform].runtimeName ? "test-report" : "package",
    location: `github-actions/run/${snapshot.runId}/artifact/${artifact.id}`,
    producedBy: `github-actions-${snapshot.platform}`,
    createdAt: new Date(0).toISOString(),
    checksum: artifact.digest,
    metadata: { commitSha: snapshot.commitSha, artifactName: artifact.name, platform: snapshot.platform },
  }));
}

export function requireTargetEvidence(
  base: ReleaseReadiness,
  targetLanes: PlatformLane[],
  snapshots: NativeVerificationSnapshot[],
): ReleaseReadiness {
  const blockers = [...base.blockers];
  for (const platform of ["android", "ios"] as const) {
    if (!targetLanes.includes(platform)) continue;
    const snapshot = snapshots.find((item) => item.platform === platform);
    if (!snapshot) {
      blockers.push(`${platform} native verification evidence missing`);
      continue;
    }
    if (!snapshot.buildPassed) blockers.push(`${platform} package build not verified`);
    if (!snapshot.runtimePassed) blockers.push(`${platform} runtime not verified`);
    if (!snapshot.artifacts.some((a) => a.name === expectedArtifacts[platform].packageName)) blockers.push(`${platform} package artifact missing`);
    if (!snapshot.artifacts.some((a) => a.name === expectedArtifacts[platform].runtimeName)) blockers.push(`${platform} runtime evidence artifact missing`);
  }
  return {
    ...base,
    blockers: [...new Set(blockers)],
    readyForCandidate: base.readyForCandidate && blockers.length === 0,
  };
}
