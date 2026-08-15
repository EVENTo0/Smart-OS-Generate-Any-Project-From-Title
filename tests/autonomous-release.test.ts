import test from "node:test";
import assert from "node:assert/strict";
import { advanceAutonomousExecution, startAutonomousExecution } from "../src/execution/autonomous-execution";
import { finalizeAutonomousRelease } from "../src/execution/autonomous-release";
import type { RunnerCapabilityAdvertisement } from "../src/execution/runner-capability";
import type { ExecutionPlan } from "../src/execution/types";

const plan: ExecutionPlan = {
  projectId: "snake-game",
  workspaceRoot: "workspaces/snake-game/build",
  executeByDefault: false,
  commands: [{
    id: "web-build",
    lane: "web",
    executable: "node",
    args: ["--check", "src/main.js"],
    workingDirectory: "workspaces/snake-game/build",
    purpose: "build",
  }],
};

const runners: RunnerCapabilityAdvertisement[] = [
  {
    runnerId: "primary-ci",
    runnerKind: "github-actions",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
    quality: 5,
    privacy: 5,
    cost: 5,
    latency: 5,
  },
  {
    runnerId: "local-codex",
    runnerKind: "codex",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
    quality: 4,
    privacy: 5,
    cost: 5,
    latency: 4,
  },
];

const billingBlocker = {
  kind: "billing" as const,
  summary: "primary CI billing unavailable",
  retryableWithoutCodeChange: true,
  routeToCodingAgent: false as const,
};

test("successful fallback evidence can reach technical RC readiness", () => {
  let session = startAutonomousExecution({
    plan,
    source: { sourceArtifactDigest: "sha256:source" },
    runnerRequest: { lane: "web", requiredTools: ["node"] },
    runners,
    requiredCommandIds: ["web-build"],
    requiredArtifactKinds: ["build", "test-report"],
    maxAttempts: 2,
  });

  session = advanceAutonomousExecution({
    session,
    runnerId: "primary-ci",
    outcome: { kind: "infrastructure-failure", blocker: billingBlocker },
    runners,
  });
  session = advanceAutonomousExecution({
    session,
    runnerId: "local-codex",
    outcome: { kind: "passed" },
    runners,
  });

  const result = finalizeAutonomousRelease({
    session,
    targetLanes: ["web"],
    approvedByHuman: false,
    successfulRunnerEvidence: {
      projectId: "snake-game",
      runnerId: "local-codex",
      runnerKind: "codex",
      runId: "fallback-run-1",
      sourceArtifactDigest: "sha256:source",
      conclusion: "success",
      commands: [{ commandId: "web-build", status: "passed" }],
      artifacts: [
        { id: "build", name: "snake-web", kind: "build", checksum: "sha256:build" },
        { id: "tests", name: "snake-tests", kind: "test-report", checksum: "sha256:tests" },
      ],
      requiredCommandIds: ["web-build"],
      requiredArtifactKinds: ["build", "test-report"],
    },
  });

  assert.equal(result.release.readiness.score, 100);
  assert.equal(result.release.readiness.readyForCandidate, true);
  assert.equal(result.release.infrastructureBlockers.length, 0);
  assert.equal(result.release.candidate.status, "blocked");
  assert.deepEqual(result.release.candidate.blockers, ["explicit human approval required"]);
  assert.equal(result.attemptHistory.length, 2);
  assert.ok(result.attemptEvidenceRefs.some((ref) => ref.includes("primary-ci/infrastructure-failure")));
});
