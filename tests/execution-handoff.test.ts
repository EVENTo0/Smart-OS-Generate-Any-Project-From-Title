import test from "node:test";
import assert from "node:assert/strict";
import { createPortableExecutionHandoff } from "../src/execution/execution-handoff";

test("portable handoff remains workspace-only and secret-free", () => {
  const handoff = createPortableExecutionHandoff(
    {
      projectId: "snake-game",
      workspaceRoot: "workspaces/snake-game/build",
      executeByDefault: false,
      commands: [
        {
          id: "web-check",
          lane: "web",
          executable: "node",
          args: ["--check", "src/main.js"],
          workingDirectory: "workspaces/snake-game/build",
          purpose: "test",
        },
      ],
    },
    {
      runnerId: "local-claude-code",
      runnerKind: "claude-code",
      hostPlatform: "linux",
      workspaceOnly: true,
      nativePlatforms: [],
      lanes: ["web"],
      availableTools: ["node"],
      allowsSecrets: false,
      allowsPublicPublish: false,
      local: true,
    },
  );

  assert.equal(handoff.policy.resolveSecrets, false);
  assert.equal(handoff.policy.allowPublicPublish, false);
  assert.equal(handoff.policy.requiresExplicitExecution, true);
  assert.equal(handoff.runnerId, "local-claude-code");
});
