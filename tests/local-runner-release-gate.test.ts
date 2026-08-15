import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ArtifactRegistry } from "../src/release/artifact-registry";
import { evaluateReleaseGate } from "../src/release/release-gate";
import { ingestRunnerEvidence, type RunnerEvidenceSnapshot } from "../src/release/runner-evidence";

const fixture = JSON.parse(
  readFileSync(new URL("../examples/snake-game/local-runner-evidence.json", import.meta.url), "utf8"),
) as RunnerEvidenceSnapshot;

test("real local runner evidence reaches the unified release gate", () => {
  const evidence = ingestRunnerEvidence(fixture);
  assert.equal(evidence.verified, true);
  assert.equal(evidence.executionResults.every((result) => result.status === "passed"), true);

  const registry = new ArtifactRegistry();
  for (const artifact of evidence.artifactRecords) registry.add(artifact);
  assert.equal(registry.hasKind("snake-game", "build"), true);
  assert.equal(registry.hasKind("snake-game", "test-report"), true);

  const technical = evaluateReleaseGate({
    projectId: "snake-game",
    targetLanes: ["web"],
    executionResults: evidence.executionResults,
    artifacts: registry.all("snake-game"),
    infrastructureBlockers: evidence.infrastructureBlockers,
    evidenceRefs: evidence.evidenceRefs,
    approvedByHuman: false,
  });

  assert.equal(technical.readiness.score, 100);
  assert.equal(technical.readiness.readyForCandidate, true);
  assert.equal(technical.candidate.status, "blocked");
  assert.deepEqual(technical.candidate.blockers, ["explicit human approval required"]);

  const approved = evaluateReleaseGate({
    projectId: "snake-game",
    targetLanes: ["web"],
    executionResults: evidence.executionResults,
    artifacts: registry.all("snake-game"),
    infrastructureBlockers: evidence.infrastructureBlockers,
    evidenceRefs: evidence.evidenceRefs,
    approvedByHuman: true,
  });

  assert.equal(approved.candidate.status, "ready");
  assert.deepEqual(approved.candidate.blockers, []);
});
