import test from "node:test";
import assert from "node:assert/strict";
import { ingestRunnerEvidence } from "../src/release/runner-evidence";

test("blocked runner evidence remains infrastructure-only", () => {
  const evidence = ingestRunnerEvidence({
    projectId: "snake-game",
    runnerId: "github-actions",
    runnerKind: "ci",
    runId: "blocked-1",
    commitSha: "abc",
    conclusion: "blocked",
    commands: [{ commandId: "web-build", status: "failed", fixCapabilityId: "web-engineering-agent" }],
    artifacts: [],
    infrastructureBlocker: {
      kind: "billing",
      summary: "spending limit reached",
      retryableWithoutCodeChange: true,
      routeToCodingAgent: false,
    },
  });

  assert.equal(evidence.verified, false);
  assert.equal(evidence.runnerId, "github-actions");
  assert.equal(evidence.infrastructureBlockers[0]?.kind, "billing");
  assert.equal(evidence.executionResults[0]?.fixCapabilityId, undefined);
});
