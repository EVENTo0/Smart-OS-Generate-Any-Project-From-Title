import test from "node:test";
import assert from "node:assert/strict";
import { createControlRunSnapshot } from "../src/control/run-snapshot";
import { advanceAutonomousExecution, startAutonomousExecution } from "../src/execution/autonomous-execution";
import { finalizeAutonomousRelease } from "../src/execution/autonomous-release";
import type { RunnerCapabilityAdvertisement } from "../src/execution/runner-capability";
import type { ExecutionPlan } from "../src/execution/types";

const plan: ExecutionPlan = {
  projectId: "snake-game",
  workspaceRoot: "workspaces/snake-game/build",
  executeByDefault: false,
  commands: [{ id: "web-build", lane: "web", executable: "node", args: ["--check", "src/main.js"], workingDirectory: "workspaces/snake-game/build", purpose: "build" }],
};

const runners: RunnerCapabilityAdvertisement[] = [
  { runnerId: "primary-ci", runnerKind: "github-actions", hostPlatform: "linux", workspaceOnly: true, nativePlatforms: [], lanes: ["web"], availableTools: ["node"], allowsSecrets: false, allowsPublicPublish: false, quality: 5, privacy: 5, cost: 5, latency: 5 },
  { runnerId: "local-codex", runnerKind: "codex", hostPlatform: "linux", workspaceOnly: true, nativePlatforms: [], lanes: ["web"], availableTools: ["node"], allowsSecrets: false, allowsPublicPublish: false, quality: 4, privacy: 5, cost: 5, latency: 4 },
];

test("control snapshot preserves history without exposing raw execution data", () => {
  let session = startAutonomousExecution({
    plan,
    source: { sourceArtifactDigest: "sha256:source" },
    runnerRequest: { lane: "web", requiredTools: ["node"] },
    runners,
    requiredCommandIds: ["web-build"],
    requiredArtifactKinds: ["build", "test-report"],
  });
  session = advanceAutonomousExecution({
    session,
    runnerId: "primary-ci",
    outcome: { kind: "infrastructure-failure", blocker: { kind: "billing", summary: "billing", retryableWithoutCodeChange: true, routeToCodingAgent: false } },
    runners,
  });
  session = advanceAutonomousExecution({ session, runnerId: "local-codex", outcome: { kind: "passed" }, runners });

  const finalized = finalizeAutonomousRelease({
    session,
    targetLanes: ["web"],
    approvedByHuman: false,
    successfulRunnerEvidence: {
      projectId: "snake-game",
      runnerId: "local-codex",
      runnerKind: "codex",
      runId: "run-1",
      sourceArtifactDigest: "sha256:source",
      conclusion: "success",
      commands: [{ commandId: "web-build", status: "passed", logRef: "secret/raw/log/path" }],
      artifacts: [
        { id: "build", name: "snake", kind: "build", checksum: "sha256:build" },
        { id: "tests", name: "tests", kind: "test-report", checksum: "sha256:tests" },
      ],
      requiredCommandIds: ["web-build"],
      requiredArtifactKinds: ["build", "test-report"],
    },
  });

  const snapshot = createControlRunSnapshot({
    projectId: "snake-game",
    title: "Snake game",
    lifecycleState: "RELEASE_CANDIDATE",
    targetLanes: ["web"],
    session,
    artifacts: finalized.artifacts,
    release: finalized.release,
  });

  assert.equal(snapshot.execution.status, "succeeded");
  assert.equal(snapshot.execution.successfulRunnerId, "local-codex");
  assert.deepEqual(snapshot.infrastructure.historicalBlockers, ["billing"]);
  assert.deepEqual(snapshot.infrastructure.activeBlockers, []);
  assert.equal(snapshot.release.score, 100);
  assert.equal(snapshot.release.candidateStatus, "blocked");
  assert.deepEqual(snapshot.release.blockers, ["explicit human approval required"]);
  assert.equal(snapshot.policy.exposesSecrets, false);
  assert.equal(snapshot.policy.exposesRawLogs, false);
  assert.equal(JSON.stringify(snapshot).includes("secret/raw/log/path"), false);
});
