import type { InfrastructureBlocker } from "../execution/infrastructure-blocker";
import type { ExecutionResult } from "../execution/types";
import type { ArtifactKind, ArtifactRecord } from "./artifact-registry";

export interface RunnerCommandEvidence {
  commandId: string;
  status: "passed" | "failed" | "skipped";
  logRef?: string;
  artifactRefs?: string[];
  fixCapabilityId?: string;
  summary?: string;
}

export interface RunnerArtifactEvidence {
  id: string;
  name: string;
  kind: ArtifactKind;
  checksum?: string;
}

export interface RunnerEvidenceSnapshot {
  projectId: string;
  runnerId: string;
  runnerKind: string;
  runId: string;
  commitSha: string;
  conclusion: "success" | "failure" | "blocked";
  commands: RunnerCommandEvidence[];
  artifacts: RunnerArtifactEvidence[];
  requiredCommandIds?: string[];
  requiredArtifactKinds?: ArtifactKind[];
  infrastructureBlocker?: InfrastructureBlocker;
}

export interface RunnerReleaseEvidence {
  projectId: string;
  runnerId: string;
  runId: string;
  commitSha: string;
  verified: boolean;
  blockers: string[];
  executionResults: ExecutionResult[];
  artifactRecords: ArtifactRecord[];
  infrastructureBlockers: InfrastructureBlocker[];
  evidenceRefs: string[];
}

export function ingestRunnerEvidence(snapshot: RunnerEvidenceSnapshot): RunnerReleaseEvidence {
  const blockers: string[] = [];
  const infrastructureBlockers = snapshot.infrastructureBlocker ? [snapshot.infrastructureBlocker] : [];

  if (snapshot.conclusion !== "success") blockers.push(`runner conclusion: ${snapshot.conclusion}`);
  for (const commandId of snapshot.requiredCommandIds ?? []) {
    if (!snapshot.commands.some((command) => command.commandId === commandId && command.status === "passed")) {
      blockers.push(`required runner command missing or failed: ${commandId}`);
    }
  }
  for (const kind of snapshot.requiredArtifactKinds ?? []) {
    if (!snapshot.artifacts.some((artifact) => artifact.kind === kind)) {
      blockers.push(`required runner artifact missing: ${kind}`);
    }
  }

  const executionResults: ExecutionResult[] = snapshot.commands.map((command) => ({
    commandId: command.commandId,
    status: command.status,
    logRefs: command.logRef ? [command.logRef] : [],
    artifactRefs: command.artifactRefs ?? [],
    fixCapabilityId: command.status === "failed" && !snapshot.infrastructureBlocker ? command.fixCapabilityId : undefined,
    summary: command.summary,
  }));

  const artifactRecords: ArtifactRecord[] = snapshot.artifacts.map((artifact) => ({
    id: `${snapshot.runnerId}-${artifact.id}`,
    projectId: snapshot.projectId,
    kind: artifact.kind,
    location: `runner/${snapshot.runnerId}/run/${snapshot.runId}/artifact/${artifact.id}`,
    producedBy: snapshot.runnerId,
    createdAt: new Date(0).toISOString(),
    checksum: artifact.checksum,
    metadata: {
      commitSha: snapshot.commitSha,
      artifactName: artifact.name,
      runnerKind: snapshot.runnerKind,
      runId: snapshot.runId,
    },
  }));

  return {
    projectId: snapshot.projectId,
    runnerId: snapshot.runnerId,
    runId: snapshot.runId,
    commitSha: snapshot.commitSha,
    verified: blockers.length === 0 && infrastructureBlockers.length === 0,
    blockers,
    executionResults,
    artifactRecords,
    infrastructureBlockers,
    evidenceRefs: [`runner/${snapshot.runnerId}/run/${snapshot.runId}`],
  };
}
