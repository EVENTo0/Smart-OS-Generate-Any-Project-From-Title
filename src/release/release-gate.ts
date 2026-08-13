import type { ExecutionResult, PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "./artifact-registry";
import { createReleaseCandidateManifest } from "./candidate";
import { requireTargetEvidence, type NativeVerificationSnapshot } from "./native-evidence";
import { assessReleaseReadiness } from "./readiness";

export function evaluateReleaseGate(input: {
  projectId: string;
  targetLanes: PlatformLane[];
  executionResults: ExecutionResult[];
  artifacts: ArtifactRecord[];
  nativeEvidence?: NativeVerificationSnapshot[];
  evidenceRefs?: string[];
  approvedByHuman?: boolean;
}) {
  const baseReadiness = assessReleaseReadiness(input.executionResults);
  const readiness = requireTargetEvidence(baseReadiness, input.targetLanes, input.nativeEvidence ?? []);
  const unresolvedFailures = input.executionResults.filter((result) => result.status === "failed").length;
  const candidate = createReleaseCandidateManifest({
    projectId: input.projectId,
    readiness,
    artifacts: input.artifacts,
    evidenceRefs: input.evidenceRefs,
    unresolvedFailures,
    approvedByHuman: input.approvedByHuman ?? false,
  });
  return { readiness, candidate };
}
