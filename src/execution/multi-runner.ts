import type { InfrastructureBlocker } from "./infrastructure-blocker";
import { routeExecutionRunner, type RunnerRequest } from "./runner-broker";
import type { RunnerCapabilityAdvertisement } from "./runner-capability";

export type RunnerAttemptOutcome =
  | { kind: "passed"; summary?: string }
  | { kind: "infrastructure-failure"; blocker: InfrastructureBlocker; summary?: string }
  | { kind: "code-failure"; summary: string; specialistCapabilityId: string };

export interface RunnerAttemptRecord {
  attempt: number;
  runnerId: string;
  outcome: RunnerAttemptOutcome;
}

export interface MultiRunnerExecutionState {
  request: RunnerRequest;
  runnerQueue: string[];
  maxAttempts: number;
  attempts: RunnerAttemptRecord[];
  status: "running" | "succeeded" | "code-fix-required" | "infrastructure-blocked";
  selectedRunnerId?: string;
  successfulRunnerId?: string;
  infrastructureBlockers: InfrastructureBlocker[];
  codeFailure?: { summary: string; specialistCapabilityId: string };
}

export function createMultiRunnerExecution(input: {
  request: RunnerRequest;
  runners: RunnerCapabilityAdvertisement[];
  maxAttempts?: number;
}): MultiRunnerExecutionState {
  const maxAttempts = input.maxAttempts ?? 4;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
    throw new Error("Invalid multi-runner max attempts");
  }

  const route = routeExecutionRunner(input.request, input.runners);
  const queue = [route.selectedRunnerId, ...route.fallbackRunnerIds]
    .filter((runnerId): runnerId is string => Boolean(runnerId))
    .filter((runnerId, index, values) => values.indexOf(runnerId) === index)
    .slice(0, maxAttempts);

  if (!queue.length) {
    return {
      request: input.request,
      runnerQueue: [],
      maxAttempts,
      attempts: [],
      status: "infrastructure-blocked",
      infrastructureBlockers: route.infrastructureBlockers,
    };
  }

  return {
    request: input.request,
    runnerQueue: queue,
    maxAttempts,
    attempts: [],
    status: "running",
    selectedRunnerId: queue[0],
    infrastructureBlockers: route.infrastructureBlockers,
  };
}

export function currentRunnerId(state: MultiRunnerExecutionState): string | undefined {
  return state.status === "running" ? state.selectedRunnerId : undefined;
}

export function recordRunnerAttempt(
  state: MultiRunnerExecutionState,
  runnerId: string,
  outcome: RunnerAttemptOutcome,
): MultiRunnerExecutionState {
  if (state.status !== "running") throw new Error("Multi-runner execution is not running");
  if (runnerId !== state.selectedRunnerId) throw new Error("Runner attempt does not match selected runner");
  if (state.attempts.some((attempt) => attempt.runnerId === runnerId)) throw new Error("Runner has already been attempted");

  const attempts: RunnerAttemptRecord[] = [
    ...state.attempts,
    { attempt: state.attempts.length + 1, runnerId, outcome },
  ];

  if (outcome.kind === "passed") {
    return {
      ...state,
      attempts,
      status: "succeeded",
      selectedRunnerId: undefined,
      successfulRunnerId: runnerId,
    };
  }

  if (outcome.kind === "code-failure") {
    return {
      ...state,
      attempts,
      status: "code-fix-required",
      selectedRunnerId: undefined,
      codeFailure: {
        summary: outcome.summary,
        specialistCapabilityId: outcome.specialistCapabilityId,
      },
    };
  }

  const infrastructureBlockers = [...state.infrastructureBlockers, outcome.blocker];
  const nextRunner = state.runnerQueue[attempts.length];
  if (!nextRunner || attempts.length >= state.maxAttempts) {
    return {
      ...state,
      attempts,
      status: "infrastructure-blocked",
      selectedRunnerId: undefined,
      infrastructureBlockers,
    };
  }

  return {
    ...state,
    attempts,
    selectedRunnerId: nextRunner,
    infrastructureBlockers,
  };
}
