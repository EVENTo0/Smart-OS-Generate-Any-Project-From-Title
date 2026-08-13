import test from "node:test";
import assert from "node:assert/strict";
import { ingestCiRun } from "../src/release/ci-evidence";

test("successful generated Snake CI run becomes verified release evidence", () => {
  const evidence = ingestCiRun({
    projectId: "snake-game",
    runId: "48",
    commitSha: "abc123",
    conclusion: "success",
    steps: [
      { name: "Run npm test", conclusion: "success" },
      { name: "Materialize generated Snake workspace", conclusion: "success" },
      { name: "Controlled Snake web build check", conclusion: "success" },
      { name: "Publish generated Snake build", conclusion: "success" },
    ],
    artifacts: [{ id: "1", name: "snake-generated-web-build", digest: "sha256:test" }],
  });
  assert.equal(evidence.verified, true);
  assert.equal(evidence.artifactRecords[0].kind, "build");
});
