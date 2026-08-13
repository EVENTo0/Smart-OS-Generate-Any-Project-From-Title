import type { ReleaseReadiness } from "./readiness";
import type { ArtifactRecord } from "./artifact-registry";

export interface ReleaseCandidateManifest {
  projectId: string;
  status: "ready" | "blocked";
  blockers: string[];
  artifactIds: string[];
  evidenceRefs: string[];
  approvedByHuman: boolean;
}

export function createReleaseCandidateManifest(input: {
  projectId: string;
  readiness: ReleaseReadiness;
  artifacts: ArtifactRecord[];
  evidenceRefs?: string[];
  unresolvedFailures?: number;
  approvedByHuman: boolean;
}): ReleaseCandidateManifest {
  const blockers = [...input.readiness.blockers];
  if (!input.readiness.readyForCandidate) blockers.push("release readiness gate not passed");
  if ((input.unresolvedFailures ?? 0) > 0) blockers.push("unresolved failures remain");
  if (!input.artifacts.some((artifact) => artifact.kind === "build")) blockers.push("build artifact missing");
  if (!input.artifacts.some((artifact) => artifact.kind === "test-report")) blockers.push("test report artifact missing");
  if (!input.approvedByHuman) blockers.push("explicit human approval required");

  return {
    projectId: input.projectId,
    status: blockers.length ? "blocked" : "ready",
    blockers: [...new Set(blockers)],
    artifactIds: input.artifacts.map((artifact) => artifact.id),
    evidenceRefs: input.evidenceRefs ?? [],
    approvedByHuman: input.approvedByHuman,
  };
}
