import type { ArtifactRecord } from "./artifact-registry";

export interface CiStepSnapshot {
  name: string;
  conclusion: "success" | "failure" | "cancelled" | "skipped" | null;
}

export interface CiArtifactSnapshot {
  id: string;
  name: string;
  digest?: string;
}

export interface CiRunSnapshot {
  projectId: string;
  runId: string;
  commitSha: string;
  conclusion: "success" | "failure" | "cancelled" | null;
  steps: CiStepSnapshot[];
  artifacts: CiArtifactSnapshot[];
}

export interface CiReleaseEvidence {
  projectId: string;
  runId: string;
  commitSha: string;
  verified: boolean;
  blockers: string[];
  artifactRecords: ArtifactRecord[];
}

export function ingestCiRun(snapshot: CiRunSnapshot): CiReleaseEvidence {
  const blockers: string[] = [];
  if (snapshot.conclusion !== "success") blockers.push("CI run did not succeed");

  const requiredSteps = [
    "Run npm test",
    "Materialize generated Snake workspace",
    "Controlled Snake web build check",
    "Publish generated Snake build",
  ];
  for (const name of requiredSteps) {
    if (!snapshot.steps.some((step) => step.name === name && step.conclusion === "success")) {
      blockers.push(`required CI step missing or failed: ${name}`);
    }
  }

  const build = snapshot.artifacts.find((artifact) => artifact.name === "snake-generated-web-build");
  if (!build) blockers.push("generated build artifact missing");

  const artifactRecords: ArtifactRecord[] = build ? [{
    id: `github-actions-${build.id}`,
    projectId: snapshot.projectId,
    kind: "build",
    location: `github-actions/run/${snapshot.runId}/artifact/${build.id}`,
    producedBy: "github-actions",
    createdAt: new Date(0).toISOString(),
    checksum: build.digest,
    metadata: { commitSha: snapshot.commitSha, artifactName: build.name },
  }] : [];

  return {
    projectId: snapshot.projectId,
    runId: snapshot.runId,
    commitSha: snapshot.commitSha,
    verified: blockers.length === 0,
    blockers,
    artifactRecords,
  };
}
