import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionPacket } from "../src/execution/execution-packet";
import type { PortableExecutionHandoff } from "../src/execution/execution-handoff";

const handoff: PortableExecutionHandoff = {
  schemaVersion: "1",
  projectId: "snake-game",
  runnerId: "local-codex",
  runnerKind: "codex",
  workspaceRoot: "workspaces/snake-game/build",
  commands: [{
    id: "web-build",
    lane: "web",
    executable: "node",
    args: ["--check", "src/main.js"],
    workingDirectory: "workspaces/snake-game/build",
    purpose: "build",
  }],
  policy: {
    workspaceOnly: true,
    resolveSecrets: false,
    allowPublicPublish: false,
    requiresExplicitExecution: true,
  },
};

test("execution packet preserves restricted policy and evidence requirements", () => {
  const packet = createExecutionPacket({
    handoff,
    sourceCommitSha: "abc123",
    requiredCommandIds: ["web-build"],
    requiredArtifactKinds: ["build", "test-report"],
  });

  assert.equal(packet.projectId, "snake-game");
  assert.equal(packet.handoff.policy.resolveSecrets, false);
  assert.equal(packet.handoff.policy.allowPublicPublish, false);
  assert.deepEqual(packet.evidence.requiredCommandIds, ["web-build"]);
});

test("execution packet rejects unknown required command", () => {
  assert.throws(() => createExecutionPacket({
    handoff,
    sourceCommitSha: "abc123",
    requiredCommandIds: ["missing-command"],
    requiredArtifactKinds: ["build"],
  }), /not present/);
});
