import test from "node:test";
import assert from "node:assert/strict";
import { ingestRunnerEvidence } from "../src/release/runner-evidence";

test("alternate runner evidence maps into release evidence", () => {
  const evidence = ingestRunnerEvidence({
    projectId: "snake-game",
    runnerId: "local-codex",
    runnerKind: "local",
    runId: "run-1",
    commitSha: "abc",
    conclusion: "success",
    commands: [
      { commandId: "repository-tests", status: "passed", logRef: "logs/tests.txt" },
      { commandId: "web-build", status: "passed", logRef: "logs/build.txt", artifactRefs: ["build"] },
    ],
    artifacts: [
      { id: "build", name: "snake-web-build", kind: "build", checksum: "sha256:test" },
      { id: "tests", name: "snake-test-report", kind: "test-report" },
    ],
    requiredCommandIds: ["repository-tests", "web-build"],
    requiredArtifactKinds: ["build", "test-report"],
  });

  assert.equal(evidence.verified, true);
  assert.equal(evidence.executionResults.every((result) => result.status === "passed"), true);
  assert.deepEqual(evidence.artifactRecords.map((artifact) => artifact.kind).sort(), ["build", "test-report"]);
  assert.deepEqual(evidence.infrastructureBlockers, []);
});
