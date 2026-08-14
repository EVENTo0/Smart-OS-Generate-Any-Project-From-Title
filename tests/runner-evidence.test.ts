import test from "node:test";
import assert from "node:assert/strict";
import { ingestRunnerEvidence } from "../src/release/runner-evidence";

test("alternate runner evidence becomes typed release evidence", () => {
  const evidence = ingestRunnerEvidence({
    projectId: "snake-game",
    runnerId: "local-codex",
    runnerKind: "codex",
    runId: "local-1",
    commitSha: "abc123",
    conclusion: "success",
    requiredCommandIds: ["web-check"],
    requiredArtifactKinds: ["build", "test-report"],
    commands: [{ commandId: "web-check", status: "passed", logRef: "logs/web-check.txt" }],
    artifacts: [
      { id: "build-1", name: "snake-web-build", kind: "build", checksum: "sha256:build" },
      { id: "tests-1", name: "snake-test-report", kind: "test-report", checksum: "sha256:tests" },
    ],
  });

  assert.equal(evidence.verified, true);
  assert.equal(evidence.executionResults[0]?.status, "passed");
  assert.equal(evidence.artifactRecords.length, 2);
  assert.equal(evidence.infrastructureBlockers.length, 0);
});
