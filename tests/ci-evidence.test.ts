import test from "node:test";
import assert from "node:assert/strict";
import { ingestCiRun } from "../src/release/ci-evidence";
import { evaluateReleaseGate } from "../src/release/release-gate";

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

test("release gate stays blocked until explicit human approval", () => {
  const common = {
    projectId: "snake-game",
    targetLanes: ["web"] as const,
    executionResults: [{ commandId: "web-runtime", status: "passed" as const, logRefs: [], artifactRefs: [] }],
    artifacts: [
      { id: "build", projectId: "snake-game", kind: "build" as const, location: "ci/build", producedBy: "ci", createdAt: new Date(0).toISOString() },
      { id: "tests", projectId: "snake-game", kind: "test-report" as const, location: "ci/tests", producedBy: "ci", createdAt: new Date(0).toISOString() },
    ],
  };
  const blocked = evaluateReleaseGate({ ...common, targetLanes: [...common.targetLanes], approvedByHuman: false });
  assert.equal(blocked.readiness.readyForCandidate, true);
  assert.equal(blocked.candidate.status, "blocked");
  assert.ok(blocked.candidate.blockers.includes("explicit human approval required"));
  const approved = evaluateReleaseGate({ ...common, targetLanes: [...common.targetLanes], approvedByHuman: true });
  assert.equal(approved.candidate.status, "ready");
});

test("infrastructure blocker prevents RC without pretending code failed", () => {
  const result = evaluateReleaseGate({
    projectId: "snake-game",
    targetLanes: ["web"],
    executionResults: [{ commandId: "web-runtime", status: "passed", logRefs: [], artifactRefs: [] }],
    artifacts: [
      { id: "build", projectId: "snake-game", kind: "build", location: "ci/build", producedBy: "ci", createdAt: new Date(0).toISOString() },
      { id: "tests", projectId: "snake-game", kind: "test-report", location: "ci/tests", producedBy: "ci", createdAt: new Date(0).toISOString() },
    ],
    infrastructureBlockers: [{ kind: "billing", summary: "Actions unavailable", retryableWithoutCodeChange: true, routeToCodingAgent: false }],
    approvedByHuman: true,
  });
  assert.equal(result.readiness.readyForCandidate, false);
  assert.ok(result.readiness.blockers.includes("infrastructure blocker: billing"));
  assert.equal(result.candidate.status, "blocked");
});
