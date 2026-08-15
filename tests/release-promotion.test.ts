import test from "node:test";
import assert from "node:assert/strict";
import { promoteReleaseCandidate } from "../src/release/promotion";
import { createStorePackagingPlan } from "../src/release/store-packaging";

const candidate = {
  projectId: "snake-game",
  status: "ready" as const,
  blockers: [],
  artifactIds: ["build", "test"],
  evidenceRefs: ["runner/local/run/1"],
  approvedByHuman: true,
};

const approval = {
  schemaVersion: "1" as const,
  requestId: "request-1",
  projectId: "snake-game",
  candidateFingerprint: `sha256:${"a".repeat(64)}`,
  decision: "approve" as const,
  actorId: "user-1",
  verifierId: "supabase-auth-edge",
  verifiedAt: "2026-08-14T23:04:13.451Z",
};

test("promotes only the exact approved RC scope", () => {
  const promotion = promoteReleaseCandidate({
    releaseCandidateId: "snake-game-0.1.0-rc.1",
    version: "0.1.0-rc.1",
    candidateFingerprint: approval.candidateFingerprint,
    targetLanes: ["web"],
    candidate,
    approval,
    promotedAt: "2026-08-14T23:13:38.707Z",
  });
  assert.equal(promotion.schemaVersion, "1");
  assert.equal(promotion.sourceManifestDigest, undefined);
  assert.equal(promotion.publicPublishAuthorized, false);
  assert.deepEqual(promotion.targetLanes, ["web"]);
  assert.throws(
    () => createStorePackagingPlan({ promotion, workspaceRoot: "workspaces/snake-game/build", targetLanes: ["android"] }),
    /not covered by the approved release scope/,
  );
});

test("source-bound v2 approval propagates the exact source manifest digest into promotion", () => {
  const sourceManifestDigest = `sha256:${"b".repeat(64)}`;
  const promotion = promoteReleaseCandidate({
    releaseCandidateId: "snake-game-0.1.0-rc.2-source-bound",
    version: "0.1.0-rc.2",
    candidateFingerprint: approval.candidateFingerprint,
    targetLanes: ["android", "ios"],
    candidate,
    approval: { ...approval, sourceManifestDigest },
    promotedAt: "2026-08-14T23:13:38.707Z",
  });
  assert.equal(promotion.schemaVersion, "2");
  assert.equal(promotion.sourceManifestDigest, sourceManifestDigest);
  assert.equal(promotion.publicPublishAuthorized, false);
});
