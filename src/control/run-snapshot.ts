import type { AutonomousExecutionSession } from "../execution/autonomous-execution";
import type { InfrastructureBlockerKind } from "../execution/infrastructure-blocker";
import type { PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "../release/artifact-registry";
import type { ReleaseCandidateManifest } from "../release/candidate";
import type { ReleaseReadiness } from "../release/readiness";

export interface ControlRunAttempt {
  attempt: number;
  runnerId: string;
  outcome: "passed" | "infrastructure-failure" | "code-failure";
  blockerKind?: InfrastructureBlockerKind;
}

export interface ControlArtifactSummary {
  id: string;
  kind: ArtifactRecord["kind"];
  producedBy: string;
  checksum?: string;
}

export interface ControlRunSnapshot {
  schemaVersion: "1";
  projectId: string;
  title: string;
  lifecycleState: string;
  targetLanes: PlatformLane[];
  execution: {
    status: AutonomousExecutionSession["state"]["status"] | "not-started";
    activeRunnerId?: string;
    successfulRunnerId?: string;
    maxAttempts?: number;
    attempts: ControlRunAttempt[];
  };
  release: {
    score: number;
    technicalReady: boolean;
    candidateStatus: "ready" | "blocked" | "not-evaluated";
    humanApprovalRequired: boolean;
    approvedByHuman: boolean;
    blockers: string[];
  };
  artifacts: ControlArtifactSummary[];
  infrastructure: {
    activeBlockers: InfrastructureBlockerKind[];
    historicalBlockers: InfrastructureBlockerKind[];
  };
  policy: {
    exposesSecrets: false;
    exposesRawLogs: false;
    allowsPublicPublish: false;
  };
}

export function createControlRunSnapshot(input: {
  projectId: string;
  title: string;
  lifecycleState: string;
  targetLanes: PlatformLane[];
  session?: AutonomousExecutionSession;
  artifacts?: ArtifactRecord[];
  release?: {
    readiness: ReleaseReadiness;
    candidate: ReleaseCandidateManifest;
    infrastructureBlockers?: { kind: InfrastructureBlockerKind }[];
  };
}): ControlRunSnapshot {
  const attempts: ControlRunAttempt[] = input.session?.state.attempts.map((attempt) => ({
    attempt: attempt.attempt,
    runnerId: attempt.runnerId,
    outcome: attempt.outcome.kind,
    blockerKind: attempt.outcome.kind === "infrastructure-failure" ? attempt.outcome.blocker.kind : undefined,
  })) ?? [];

  const historicalBlockers = attempts
    .map((attempt) => attempt.blockerKind)
    .filter((kind): kind is InfrastructureBlockerKind => Boolean(kind));
  const activeBlockers = input.release?.infrastructureBlockers?.map((blocker) => blocker.kind) ?? [];

  return {
    schemaVersion: "1",
    projectId: input.projectId,
    title: input.title,
    lifecycleState: input.lifecycleState,
    targetLanes: [...input.targetLanes],
    execution: {
      status: input.session?.state.status ?? "not-started",
      activeRunnerId: input.session?.state.selectedRunnerId,
      successfulRunnerId: input.session?.state.successfulRunnerId,
      maxAttempts: input.session?.state.maxAttempts,
      attempts,
    },
    release: {
      score: input.release?.readiness.score ?? 0,
      technicalReady: input.release?.readiness.readyForCandidate ?? false,
      candidateStatus: input.release?.candidate.status ?? "not-evaluated",
      humanApprovalRequired: true,
      approvedByHuman: input.release?.candidate.approvedByHuman ?? false,
      blockers: [...(input.release?.candidate.blockers ?? [])],
    },
    artifacts: (input.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      producedBy: artifact.producedBy,
      checksum: artifact.checksum,
    })),
    infrastructure: {
      activeBlockers: [...new Set(activeBlockers)],
      historicalBlockers: [...new Set(historicalBlockers)],
    },
    policy: {
      exposesSecrets: false,
      exposesRawLogs: false,
      allowsPublicPublish: false,
    },
  };
}
