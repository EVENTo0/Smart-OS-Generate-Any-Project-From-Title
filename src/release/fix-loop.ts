export interface FailureSignal {
  id: string;
  commandId: string;
  summary: string;
  specialistCapabilityId: string;
}

export interface FixIteration {
  iteration: number;
  failureId: string;
  capabilityId: string;
  actionSummary: string;
  retestStatus: "passed" | "failed";
}

export interface FixLoopState {
  maxIterations: number;
  iterations: FixIteration[];
  status: "open" | "passed" | "blocked";
}

export function createFixLoop(maxIterations = 3): FixLoopState {
  if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > 10) throw new Error("Invalid max iterations");
  return { maxIterations, iterations: [], status: "open" };
}

export function recordFixIteration(state: FixLoopState, iteration: Omit<FixIteration, "iteration">): FixLoopState {
  if (state.status !== "open") throw new Error("Fix loop is not open");
  const next: FixIteration = { ...iteration, iteration: state.iterations.length + 1 };
  const iterations = [...state.iterations, next];
  const status = iteration.retestStatus === "passed" ? "passed" : iterations.length >= state.maxIterations ? "blocked" : "open";
  return { ...state, iterations, status };
}
