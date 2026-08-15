import type { ArtifactKind } from "../release/artifact-registry";
import { createPortableExecutionHandoff } from "./execution-handoff";
import { createExecutionPacket, type PortableExecutionPacket } from "./execution-packet";
import {
  createMultiRunnerExecution,
  currentRunnerId,
  recordRunnerAttempt,
  type MultiRunnerExecutionState,
  type RunnerAttemptOutcome,
} from "./multi-runner";
import type { RunnerRequest } from "./runner-broker";
import type { RunnerCapabilityAdvertisement } from "./runner-capability";
import type { ExecutionPlan } from "./types";

export interface AutonomousExecutionSource {
  sourceCommitSha?: string;
  sourceArtifactDigest?: string;
}

export interface AutonomousExecutionSession {
  plan: ExecutionPlan;
  source: AutonomousExecutionSource;
  requiredCommandIds: string[];
  requiredArtifactKinds: ArtifactKind[];
  state: MultiRunnerExecutionState;
  currentPacket?: PortableExecutionPacket;
}

function packetForCurrentRunner(input: {
  plan: ExecutionPlan;
  source: AutonomousExecutionSource;
  requiredCommandIds: string[];
  requiredArtifactKinds: ArtifactKind[];
  state: MultiRunnerExecutionState;
  runners: RunnerCapabilityAdvertisement[];
}): PortableExecutionPacket | undefined {
  const runnerId = currentRunnerId(input.state);
  if (!runnerId) return undefined;
  const runner = input.runners.find((item) => item.runnerId === runnerId);
  if (!runner) throw new Error(`Selected runner profile missing: ${runnerId}`);

  const handoff = createPortableExecutionHandoff(input.plan, runner);
  return createExecutionPacket({
    handoff,
    sourceCommitSha: input.source.sourceCommitSha,
    sourceArtifactDigest: input.source.sourceArtifactDigest,
    requiredCommandIds: input.requiredCommandIds,
    requiredArtifactKinds: input.requiredArtifactKinds,
  });
}

export function startAutonomousExecution(input: {
  plan: ExecutionPlan;
  source: AutonomousExecutionSource;
  runnerRequest: RunnerRequest;
  runners: RunnerCapabilityAdvertisement[];
  requiredCommandIds: string[];
  requiredArtifactKinds: ArtifactKind[];
  maxAttempts?: number;
}): AutonomousExecutionSession {
  const state = createMultiRunnerExecution({
    request: input.runnerRequest,
    runners: input.runners,
    maxAttempts: input.maxAttempts,
  });

  return {
    plan: input.plan,
    source: { ...input.source },
    requiredCommandIds: [...new Set(input.requiredCommandIds)],
    requiredArtifactKinds: [...new Set(input.requiredArtifactKinds)],
    state,
    currentPacket: packetForCurrentRunner({
      plan: input.plan,
      source: input.source,
      requiredCommandIds: input.requiredCommandIds,
      requiredArtifactKinds: input.requiredArtifactKinds,
      state,
      runners: input.runners,
    }),
  };
}

export function advanceAutonomousExecution(input: {
  session: AutonomousExecutionSession;
  runnerId: string;
  outcome: RunnerAttemptOutcome;
  runners: RunnerCapabilityAdvertisement[];
}): AutonomousExecutionSession {
  const state = recordRunnerAttempt(input.session.state, input.runnerId, input.outcome);

  return {
    ...input.session,
    state,
    currentPacket: packetForCurrentRunner({
      plan: input.session.plan,
      source: input.session.source,
      requiredCommandIds: input.session.requiredCommandIds,
      requiredArtifactKinds: input.session.requiredArtifactKinds,
      state,
      runners: input.runners,
    }),
  };
}
