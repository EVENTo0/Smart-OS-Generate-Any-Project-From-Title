import test from "node:test";
import assert from "node:assert/strict";
import { advanceAutonomousExecution, startAutonomousExecution } from "../src/execution/autonomous-execution";
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
    availability: "available",
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
    local: true,
    quality: 4,
    privacy: 5,
    availability: "available",
  },
];

const billingBlocker = {
  kind: "billing" as const,
  summary: "primary CI spending limit reached",
  retryableWithoutCodeChange: true,
  routeToCodingAgent: false as const,
};

test("autonomous execution emits a new packet for fallback runner", () => {
  let session = startAutonomousExecution({
    plan,
    source: { sourceArtifactDigest: "sha256:71e2b2db526ad8fa1fb83ebf981729d94d18cde26cfb0139449958235800a123" },
    runnerRequest: { lane: "web", requiredTools: ["node"] },
    runners,
    requiredCommandIds: ["web-build"],
    requiredArtifactKinds: ["build", "test-report"],
    maxAttempts: 2,
  });

  assert.equal(session.currentPacket?.handoff.runnerId, "primary-ci");
  assert.match(session.currentPacket?.sourceArtifactDigest ?? "", /^sha256:/);

  session = advanceAutonomousExecution({
    session,
    runnerId: "primary-ci",
    outcome: { kind: "infrastructure-failure", blocker: billingBlocker },
    runners,
  });

  assert.equal(session.state.status, "running");
  assert.equal(session.currentPacket?.handoff.runnerId, "local-codex");

  session = advanceAutonomousExecution({
    session,
    runnerId: "local-codex",
    outcome: { kind: "passed" },
    runners,
  });

  assert.equal(session.state.status, "succeeded");
  assert.equal(session.state.successfulRunnerId, "local-codex");
  assert.equal(session.currentPacket, undefined);
});
