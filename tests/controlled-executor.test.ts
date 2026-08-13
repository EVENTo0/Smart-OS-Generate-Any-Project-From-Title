import test from "node:test";
import assert from "node:assert/strict";
import { executeWithRunner, validateControlledCommand } from "../src/execution/controlled";
import type { CommandDescriptor } from "../src/execution/types";

const allowed: CommandDescriptor = {
  id: "web-build",
  lane: "web",
  executable: "node",
  args: ["--check", "src/main.js"],
  workingDirectory: "workspaces/snake-game/build",
  purpose: "build",
};

test("controlled executor accepts only allowlisted workspace command", async () => {
  validateControlledCommand("snake-game", allowed);
  const result = await executeWithRunner("snake-game", allowed, {
    async run() { return { exitCode: 0, summary: "syntax ok" }; },
  });
  assert.equal(result.status, "passed");
});

test("controlled executor rejects workspace escape", () => {
  assert.throws(() => validateControlledCommand("snake-game", { ...allowed, workingDirectory: "../other" }));
});

test("controlled executor captures failure routing", async () => {
  const result = await executeWithRunner("snake-game", allowed, {
    async run() { return { exitCode: 1, summary: "syntax failed" }; },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.fixCapabilityId, "web-engineering-agent");
});
