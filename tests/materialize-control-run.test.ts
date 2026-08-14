import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AutonomousExecutionSession } from "../src/execution/autonomous-execution";
import { materializeControlRun } from "../src/control/materialize-run";

const session: AutonomousExecutionSession = {
  plan: {
    projectId: "snake-game",
    workspaceRoot: "workspaces/snake-game/build",
    executeByDefault: false,
    commands: [],
  },
  source: { sourceArtifactDigest: "sha256:source" },
  requiredCommandIds: [],
  requiredArtifactKinds: ["build", "test-report"],
  state: {
    request: { lane: "web" },
    runnerQueue: ["primary-ci", "local-codex"],
    maxAttempts: 2,
    attempts: [
      {
        attempt: 1,
        runnerId: "primary-ci",
        outcome: {
          kind: "infrastructure-failure",
          blocker: { kind: "billing", summary: "billing", retryableWithoutCodeChange: true, routeToCodingAgent: false },
        },
      },
      { attempt: 2, runnerId: "local-codex", outcome: { kind: "passed" } },
    ],
    status: "succeeded",
    successfulRunnerId: "local-codex",
    infrastructureBlockers: [{ kind: "billing", summary: "billing", retryableWithoutCodeChange: true, routeToCodingAgent: false }],
  },
};

test("materializeControlRun publishes latest safe phone snapshot", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "smart-os-materialize-"));
  const result = await materializeControlRun({
    repositoryRoot,
    snapshotKey: "run-001",
    projectId: "snake-game",
    title: "Snake game",
    lifecycleState: "RELEASE_CANDIDATE",
    targetLanes: ["web"],
    session,
    artifacts: [
      { id: "build", projectId: "snake-game", kind: "build", location: "runner/build", producedBy: "local-codex", createdAt: new Date(0).toISOString() },
      { id: "tests", projectId: "snake-game", kind: "test-report", location: "runner/tests", producedBy: "local-codex", createdAt: new Date(0).toISOString() },
    ],
    release: {
      readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
      candidate: {
        projectId: "snake-game",
        status: "blocked",
        blockers: ["explicit human approval required"],
        artifactIds: ["build", "tests"],
        evidenceRefs: ["runner/local-codex/run/1"],
        approvedByHuman: false,
      },
      infrastructureBlockers: [],
    },
  });

  const written = JSON.parse(await readFile(result.files.latestPath, "utf8"));
  assert.equal(written.execution.successfulRunnerId, "local-codex");
  assert.deepEqual(written.infrastructure.activeBlockers, []);
  assert.deepEqual(written.infrastructure.historicalBlockers, ["billing"]);
  assert.equal(written.release.score, 100);
  assert.equal(written.policy.exposesRawLogs, false);
});

test("materializeControlRun rejects a mismatched project session", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "smart-os-materialize-"));
  await assert.rejects(
    materializeControlRun({
      repositoryRoot,
      snapshotKey: "run-002",
      projectId: "other-project",
      title: "Other",
      lifecycleState: "BUILDING",
      targetLanes: ["web"],
      session,
      artifacts: [],
      release: {
        readiness: { score: 0, readyForCandidate: false, blockers: ["not ready"], requiredHumanApproval: true },
        candidate: { projectId: "other-project", status: "blocked", blockers: ["not ready"], artifactIds: [], evidenceRefs: [], approvedByHuman: false },
      },
    }),
    /does not match/,
  );
});
