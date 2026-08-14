import type { PlatformLane } from "./types";
import type { AutonomousExecutionSession } from "./autonomous-execution";
import { ArtifactRegistry } from "../release/artifact-registry";
import { evaluateReleaseGate } from "../release/release-gate";
import { ingestRunnerEvidence, type RunnerEvidenceSnapshot } from "../release/runner-evidence";
import type { NativeVerificationSnapshot } from "../release/native-evidence";

export function autonomousAttemptEvidenceRefs(session: AutonomousExecutionSession): string[] {
  return session.state.attempts.map((attempt) =>
    `runner-session/attempt/${attempt.attempt}/${attempt.runnerId}/${attempt.outcome.kind}`,
  );
}

export function finalizeAutonomousRelease(input: {
  session: AutonomousExecutionSession;
  successfulRunnerEvidence: RunnerEvidenceSnapshot;
  targetLanes: PlatformLane[];
  nativeEvidence?: NativeVerificationSnapshot[];
  approvedByHuman?: boolean;
}) {
  if (input.session.state.status !== "succeeded") {
    throw new Error("Autonomous execution must succeed before release finalization");
  }
  const successfulRunnerId = input.session.state.successfulRunnerId;
  if (!successfulRunnerId) throw new Error("Successful runner identity missing");
  if (input.successfulRunnerEvidence.runnerId !== successfulRunnerId) {
    throw new Error("Runner evidence does not match the successful autonomous runner");
  }

  const evidence = ingestRunnerEvidence(input.successfulRunnerEvidence);
  const registry = new ArtifactRegistry();
  for (const artifact of evidence.artifactRecords) registry.add(artifact);

  const attemptEvidenceRefs = autonomousAttemptEvidenceRefs(input.session);
  const release = evaluateReleaseGate({
    projectId: input.session.plan.projectId,
    targetLanes: input.targetLanes,
    executionResults: evidence.executionResults,
    artifacts: registry.all(input.session.plan.projectId),
    nativeEvidence: input.nativeEvidence,
    infrastructureBlockers: evidence.infrastructureBlockers,
    evidenceRefs: [...evidence.evidenceRefs, ...attemptEvidenceRefs],
    approvedByHuman: input.approvedByHuman ?? false,
  });

  return {
    evidence,
    artifacts: registry.all(input.session.plan.projectId),
    attemptHistory: [...input.session.state.attempts],
    attemptEvidenceRefs,
    release,
  };
}
