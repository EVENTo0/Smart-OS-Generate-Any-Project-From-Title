import type { ExecutionResult, PlatformLane } from "../execution/types";
import type { InfrastructureBlocker } from "../execution/infrastructure-blocker";
import type { ArtifactRecord } from "./artifact-registry";
import { createReleaseCandidateManifest } from "./candidate";
import { requireTargetEvidence, type NativeVerificationSnapshot } from "./native-evidence";
import { assessReleaseReadiness, type ReleaseReadiness } from "./readiness";

export function evaluateReleaseGate(input: {
  projectId: string;
  targetLanes: PlatformLane[];
  executionResults: ExecutionResult[];
  artifacts: ArtifactRecord[];
  nativeEvidence?: NativeVerificationSnapshot[];
  infrastructureBlockers?: InfrastructureBlocker[];
  evidenceRefs?: string[];
  approvedByHuman?: boolean;
}) {
  const baseReadiness = assessReleaseReadiness(input.executionResults);
  const nativeReadiness = requireTargetEvidence(baseReadiness, input.targetLanes, input.nativeEvidence ?? []);
  const infrastructureBlockers = input.infrastructureBlockers ?? [];
  const readiness: ReleaseReadiness = infrastructureBlockers.length
    ? {
        ...nativeReadiness,
        readyForCandidate: false,
        blockers: [
          ...nativeReadiness.blockers,
          ...infrastructureBlockers.map((blocker) => `infrastructure blocker: ${blocker.kind}`),
        ],
      }
    : nativeReadiness;
  const unresolvedFailures = input.executionResults.filter((result) => result.status === "failed").length;
  const candidate = createReleaseCandidateManifest({
    projectId: input.projectId,
    readiness,
    artifacts: input.artifacts,
    evidenceRefs: input.evidenceRefs,
    unresolvedFailures,
    approvedByHuman: input.approvedByHuman ?? false,
  });
  return { readiness, candidate, infrastructureBlockers };
}
