import type { PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "../release/artifact-registry";
import type { ReleaseCandidateManifest } from "../release/candidate";
import type { ReleaseReadiness } from "../release/readiness";
import {
  createReleaseApprovalRequest,
  type ReleaseApprovalRequest,
} from "./release-approval";

export function createAutonomousReleaseApprovalRequest(input: {
  requestId: string;
  projectId: string;
  targetLanes: PlatformLane[];
  artifacts: ArtifactRecord[];
  release: {
    readiness: ReleaseReadiness;
    candidate: ReleaseCandidateManifest;
  };
  requestedAt: string;
  expiresAt: string;
}): ReleaseApprovalRequest {
  return createReleaseApprovalRequest({
    requestId: input.requestId,
    projectId: input.projectId,
    targetLanes: input.targetLanes,
    artifacts: input.artifacts,
    readiness: input.release.readiness,
    candidate: input.release.candidate,
    requestedAt: input.requestedAt,
    expiresAt: input.expiresAt,
  });
}
