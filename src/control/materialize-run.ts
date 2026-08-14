import type { AutonomousExecutionSession } from "../execution/autonomous-execution";
import type { PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "../release/artifact-registry";
import type { ReleaseCandidateManifest } from "../release/candidate";
import type { ReleaseReadiness } from "../release/readiness";
import { createControlRunSnapshot, type ControlRunSnapshot } from "./run-snapshot";
import { writeControlSnapshot, type ControlSnapshotWriteResult } from "./snapshot-store";

export interface MaterializedControlRun {
  snapshot: ControlRunSnapshot;
  files: ControlSnapshotWriteResult;
}

export async function materializeControlRun(input: {
  repositoryRoot: string;
  snapshotKey: string;
  projectId: string;
  title: string;
  lifecycleState: string;
  targetLanes: PlatformLane[];
  session: AutonomousExecutionSession;
  artifacts: ArtifactRecord[];
  release: {
    readiness: ReleaseReadiness;
    candidate: ReleaseCandidateManifest;
    infrastructureBlockers?: { kind: Parameters<typeof createControlRunSnapshot>[0]["release"] extends infer R
      ? R extends { infrastructureBlockers?: (infer B)[] }
        ? B extends { kind: infer K }
          ? K
          : never
        : never
      : never }[];
  };
  maxHistoryEntries?: number;
}): Promise<MaterializedControlRun> {
  if (input.session.plan.projectId !== input.projectId) {
    throw new Error("Control materialization project does not match execution session");
  }

  const snapshot = createControlRunSnapshot({
    projectId: input.projectId,
    title: input.title,
    lifecycleState: input.lifecycleState,
    targetLanes: input.targetLanes,
    session: input.session,
    artifacts: input.artifacts,
    release: input.release,
  });

  const files = await writeControlSnapshot({
    repositoryRoot: input.repositoryRoot,
    snapshot,
    snapshotKey: input.snapshotKey,
    maxHistoryEntries: input.maxHistoryEntries,
  });

  return { snapshot, files };
}
