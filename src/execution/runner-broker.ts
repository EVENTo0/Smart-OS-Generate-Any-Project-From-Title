import type { InfrastructureBlocker } from "./infrastructure-blocker";
import {
  supportsLane,
  type RunnerCapabilityAdvertisement,
} from "./runner-capability";
import type { PlatformLane } from "./types";

export interface RunnerRequest {
  lane: PlatformLane;
  requiredTools?: string[];
  preferLocal?: boolean;
  requireWorkspaceOnly?: true;
  maxEstimatedCostUnits?: number;
  maxEstimatedLatencyMs?: number;
}

export interface RunnerCandidateEvaluation {
  runnerId: string;
  eligible: boolean;
  score: number;
  reasons: string[];
  blocker?: InfrastructureBlocker;
}

export interface RunnerRouteDecision {
  selectedRunnerId?: string;
  fallbackRunnerIds: string[];
  evaluations: RunnerCandidateEvaluation[];
  infrastructureBlockers: InfrastructureBlocker[];
}

const metric = (value: number | undefined, fallback: number) => value ?? fallback;

function validateBudget(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be a non-negative number`);
  }
}

function evaluateRunner(
  runner: RunnerCapabilityAdvertisement,
  request: RunnerRequest,
): RunnerCandidateEvaluation {
  const reasons: string[] = [];
  const availability = runner.availability ?? "available";

  if (!runner.workspaceOnly) reasons.push("runner is not workspace-only");
  if (runner.allowsSecrets) reasons.push("runner allows secrets in this restricted route");
  if (runner.allowsPublicPublish) reasons.push("runner allows public publication in this restricted route");
  if (!supportsLane(runner, request.lane)) reasons.push(`runner does not support lane: ${request.lane}`);
  if (request.lane === "ios" && runner.hostPlatform.toLowerCase() !== "macos") {
    reasons.push("iOS execution requires a macOS host");
  }

  const missingTools = (request.requiredTools ?? []).filter((tool) => !runner.availableTools.includes(tool));
  for (const tool of missingTools) reasons.push(`missing tool: ${tool}`);

  if (request.maxEstimatedCostUnits !== undefined) {
    if (runner.estimatedCostUnits === undefined) reasons.push("runner cost estimate missing");
    else if (runner.estimatedCostUnits > request.maxEstimatedCostUnits) reasons.push("runner exceeds cost budget");
  }
  if (request.maxEstimatedLatencyMs !== undefined) {
    if (runner.estimatedLatencyMs === undefined) reasons.push("runner latency estimate missing");
    else if (runner.estimatedLatencyMs > request.maxEstimatedLatencyMs) reasons.push("runner exceeds latency budget");
  }

  if (availability !== "available") {
    reasons.push(`runner availability: ${availability}`);
    if (runner.blocker) reasons.push(`infrastructure blocker: ${runner.blocker.kind}`);
  }

  const eligible = reasons.length === 0;
  const score = eligible
    ? metric(runner.quality, 3) * 4
      + metric(runner.privacy, 3) * 3
      + metric(runner.cost, 3)
      + metric(runner.latency, 3)
      + (request.preferLocal && runner.local ? 12 : 0)
    : Number.NEGATIVE_INFINITY;

  return {
    runnerId: runner.runnerId,
    eligible,
    score,
    reasons,
    blocker: runner.blocker,
  };
}

export function routeExecutionRunner(
  request: RunnerRequest,
  runners: RunnerCapabilityAdvertisement[],
): RunnerRouteDecision {
  validateBudget(request.maxEstimatedCostUnits, "maxEstimatedCostUnits");
  validateBudget(request.maxEstimatedLatencyMs, "maxEstimatedLatencyMs");

  const evaluations = runners
    .map((runner) => evaluateRunner(runner, request))
    .sort((a, b) => b.score - a.score || a.runnerId.localeCompare(b.runnerId));

  const eligible = evaluations.filter((item) => item.eligible);
  const infrastructureBlockers = evaluations
    .map((item) => item.blocker)
    .filter((item): item is InfrastructureBlocker => Boolean(item));

  return {
    selectedRunnerId: eligible[0]?.runnerId,
    fallbackRunnerIds: eligible.slice(1).map((item) => item.runnerId),
    evaluations,
    infrastructureBlockers,
  };
}
