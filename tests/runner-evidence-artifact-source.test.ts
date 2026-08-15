import test from "node:test";
import assert from "node:assert/strict";
import { ingestRunnerEvidence } from "../src/release/runner-evidence";

test("alternate runner evidence can use source artifact digest provenance", () => {
  const evidence = ingestRunnerEvidence({
    projectId: "snake-game",
    runnerId: "local-chatgpt-container",
    runnerKind: "local-shell",
    runId: "local-web-001",
    sourceArtifactDigest: "sha256:71e2b2db526ad8fa1fb83ebf981729d94d18cde26cfb0139449958235800a123",
    conclusion: "success",
    commands: [{ commandId: "web-build", status: "passed" }],
    artifacts: [
      { id: "build", name: "snake-generated-web-build", kind: "build" },
      { id: "tests", name: "local-node-check-report", kind: "test-report" },
    ],
    requiredCommandIds: ["web-build"],
    requiredArtifactKinds: ["build", "test-report"],
  });

  assert.equal(evidence.verified, true);
  assert.equal(evidence.commitSha, undefined);
  assert.match(evidence.sourceArtifactDigest ?? "", /^sha256:/);
  assert.equal(evidence.artifactRecords[0]?.metadata?.sourceArtifactDigest, evidence.sourceArtifactDigest);
});
