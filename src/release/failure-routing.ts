import { classifyInfrastructureBlocker, type InfrastructureSignal } from "../execution/infrastructure-blocker";
import type { FailureSignal } from "./fix-loop";

export type RemediationDecision =
  | { kind: "infrastructure"; blocker: NonNullable<ReturnType<typeof classifyInfrastructureBlocker>> }
  | { kind: "code"; failure: FailureSignal };

export function routeFailureForRemediation(input: {
  id: string;
  commandId: string;
  summary: string;
  specialistCapabilityId: string;
  infrastructure?: Omit<InfrastructureSignal, "message">;
}): RemediationDecision {
  const blocker = classifyInfrastructureBlocker({
    message: input.summary,
    ...input.infrastructure,
  });
  if (blocker) return { kind: "infrastructure", blocker };

  return {
    kind: "code",
    failure: {
      id: input.id,
      commandId: input.commandId,
      summary: input.summary,
      specialistCapabilityId: input.specialistCapabilityId,
    },
  };
}
