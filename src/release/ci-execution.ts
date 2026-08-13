import type { ExecutionResult } from "../execution/types";
import type { CiRunSnapshot } from "./ci-evidence";
import type { ArtifactRecord } from "./artifact-registry";

function success(snapshot: CiRunSnapshot, name: string): boolean {
  return snapshot.steps.some((step) => step.name === name && step.conclusion === "success");
}

export function ciExecutionResults(snapshot: CiRunSnapshot): ExecutionResult[] {
  const run = `github-actions/run/${snapshot.runId}`;
  const testsPassed = success(snapshot, "Run npm test");
  const buildPassed = success(snapshot, "Controlled Snake web build check");
  return [
    {
      commandId: "ci-repository-tests",
      status: testsPassed ? "passed" : "failed",
      logRefs: [`${run}/step/npm-test`],
      artifactRefs: [],
      fixCapabilityId: testsPassed ? undefined : "general-build-engineer",
    },
    {
      commandId: "web-build",
      status: buildPassed ? "passed" : "failed",
      logRefs: [`${run}/step/web-build-check`],
      artifactRefs: [],
      fixCapabilityId: buildPassed ? undefined : "web-engineering-agent",
    },
  ];
}

export function ciTestReportRecord(snapshot: CiRunSnapshot): ArtifactRecord | null {
  if (!success(snapshot, "Run npm test")) return null;
  return {
    id: `github-actions-${snapshot.runId}-test-report`,
    projectId: snapshot.projectId,
    kind: "test-report",
    location: `github-actions/run/${snapshot.runId}/step/npm-test`,
    producedBy: "github-actions",
    createdAt: new Date(0).toISOString(),
    metadata: { commitSha: snapshot.commitSha },
  };
}
