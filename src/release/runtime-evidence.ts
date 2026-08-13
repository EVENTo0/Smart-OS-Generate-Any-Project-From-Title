import type { ExecutionResult } from "../execution/types";
import type { CiRunSnapshot } from "./ci-evidence";
import { assessReleaseReadiness, type ReleaseReadiness } from "./readiness";
import { ciExecutionResults } from "./ci-execution";

export const SNAKE_RUNTIME_STEP = "Verify generated Snake in Chromium";

export interface RuntimeEvidence {
  projectId: string;
  runId: string;
  runtime: "chromium";
  verified: boolean;
  blockers: string[];
  executionResult: ExecutionResult;
  readiness: ReleaseReadiness;
}

function runtimePassed(snapshot: CiRunSnapshot): boolean {
  return snapshot.steps.some((step) => step.name === SNAKE_RUNTIME_STEP && step.conclusion === "success");
}

export function ingestSnakeRuntimeEvidence(snapshot: CiRunSnapshot): RuntimeEvidence {
  const passed = snapshot.conclusion === "success" && runtimePassed(snapshot);
  const executionResult: ExecutionResult = {
    commandId: "web-runtime-chromium",
    status: passed ? "passed" : "failed",
    logRefs: [`github-actions/run/${snapshot.runId}/step/chromium-runtime`],
    artifactRefs: [],
    fixCapabilityId: passed ? undefined : "web-engineering-agent",
    summary: passed ? "generated Snake passed Chromium runtime verification" : "generated Snake browser runtime verification failed or is missing",
  };
  const results = [...ciExecutionResults(snapshot), executionResult];
  const readiness = assessReleaseReadiness(results);
  const blockers = passed ? [] : ["Chromium runtime verification missing or failed"];
  return {
    projectId: snapshot.projectId,
    runId: snapshot.runId,
    runtime: "chromium",
    verified: passed,
    blockers,
    executionResult,
    readiness,
  };
}
