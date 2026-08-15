import type { RunnerCapabilityAdvertisement } from "./runner-capability";
import { routeExecutionRunner, type RunnerRequest, type RunnerRouteDecision } from "./runner-broker";
import { routeFailureForRemediation } from "../release/failure-routing";
import type { FailureSignal } from "../release/fix-loop";
import type { InfrastructureBlocker, InfrastructureSignal } from "./infrastructure-blocker";

export type ResilientExecutionDecision =
  | { kind: "code-fix"; failure: FailureSignal }
  | { kind: "reroute"; blocker: InfrastructureBlocker; runnerId: string; fallbackRunnerIds: string[] }
  | { kind: "infrastructure-blocked"; blocker: InfrastructureBlocker; route: RunnerRouteDecision };

export function decideResilientExecution(input: {
  failureId: string;
  commandId: string;
  summary: string;
  specialistCapabilityId: string;
  infrastructure?: Omit<InfrastructureSignal, "message">;
  runnerRequest: RunnerRequest;
  runners: RunnerCapabilityAdvertisement[];
}): ResilientExecutionDecision {
  const remediation = routeFailureForRemediation({
    id: input.failureId,
    commandId: input.commandId,
    summary: input.summary,
    specialistCapabilityId: input.specialistCapabilityId,
    infrastructure: input.infrastructure,
  });

  if (remediation.kind === "code") {
    return { kind: "code-fix", failure: remediation.failure };
  }

  const route = routeExecutionRunner(input.runnerRequest, input.runners);
  if (route.selectedRunnerId) {
    return {
      kind: "reroute",
      blocker: remediation.blocker,
      runnerId: route.selectedRunnerId,
      fallbackRunnerIds: route.fallbackRunnerIds,
    };
  }

  return { kind: "infrastructure-blocked", blocker: remediation.blocker, route };
}
