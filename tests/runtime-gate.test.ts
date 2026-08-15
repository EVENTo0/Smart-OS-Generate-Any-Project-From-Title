import test from "node:test";
import assert from "node:assert/strict";
import { ingestSnakeRuntimeEvidence } from "../src/release/runtime-evidence";

const base = {
  projectId: "snake-game",
  runId: "60",
  commitSha: "abc",
  conclusion: "success" as const,
  artifacts: [],
};

test("runtime gate follows Chromium result", () => {
  const passed = ingestSnakeRuntimeEvidence({ ...base, steps: [
    { name: "Run npm test", conclusion: "success" as const },
    { name: "Controlled Snake web build check", conclusion: "success" as const },
    { name: "Verify generated Snake in Chromium", conclusion: "success" as const },
  ]});
  assert.equal(passed.verified, true);
  assert.equal(passed.readiness.readyForCandidate, true);

  const failed = ingestSnakeRuntimeEvidence({ ...base, steps: [
    { name: "Run npm test", conclusion: "success" as const },
    { name: "Controlled Snake web build check", conclusion: "success" as const },
    { name: "Verify generated Snake in Chromium", conclusion: "failure" as const },
  ]});
  assert.equal(failed.verified, false);
  assert.equal(failed.readiness.readyForCandidate, false);
});
