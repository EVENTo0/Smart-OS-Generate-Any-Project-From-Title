import type { ArtifactKind } from "../release/artifact-registry";
import type { PortableExecutionHandoff } from "./execution-handoff";

export interface ExecutionEvidenceContract {
  requiredCommandIds: string[];
  requiredArtifactKinds: ArtifactKind[];
  checksumPreferred: true;
  reportInfrastructureBlocker: true;
}

export interface PortableExecutionPacket {
  schemaVersion: "1";
  projectId: string;
  sourceCommitSha?: string;
  sourceArtifactDigest?: string;
  handoff: PortableExecutionHandoff;
  evidence: ExecutionEvidenceContract;
}

export function createExecutionPacket(input: {
  handoff: PortableExecutionHandoff;
  sourceCommitSha?: string;
  sourceArtifactDigest?: string;
  requiredCommandIds: string[];
  requiredArtifactKinds: ArtifactKind[];
}): PortableExecutionPacket {
  const sourceCommitSha = input.sourceCommitSha?.trim();
  const sourceArtifactDigest = input.sourceArtifactDigest?.trim();
  if (!sourceCommitSha && !sourceArtifactDigest) {
    throw new Error("sourceCommitSha or sourceArtifactDigest is required");
  }
  if (sourceArtifactDigest && !sourceArtifactDigest.startsWith("sha256:")) {
    throw new Error("sourceArtifactDigest must use sha256 provenance");
  }

  const commandIds = new Set(input.handoff.commands.map((command) => command.id));
  for (const commandId of input.requiredCommandIds) {
    if (!commandIds.has(commandId)) throw new Error(`Required command is not present in handoff: ${commandId}`);
  }

  if (!input.handoff.policy.workspaceOnly || input.handoff.policy.resolveSecrets || input.handoff.policy.allowPublicPublish) {
    throw new Error("Execution packet requires the restricted portable handoff policy");
  }

  return {
    schemaVersion: "1",
    projectId: input.handoff.projectId,
    sourceCommitSha,
    sourceArtifactDigest,
    handoff: input.handoff,
    evidence: {
      requiredCommandIds: [...new Set(input.requiredCommandIds)],
      requiredArtifactKinds: [...new Set(input.requiredArtifactKinds)],
      checksumPreferred: true,
      reportInfrastructureBlocker: true,
    },
  };
}
