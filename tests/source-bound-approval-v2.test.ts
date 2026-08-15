import test from "node:test";
import assert from "node:assert/strict";
import {
  createReleaseApprovalRequest,
  releaseCandidateFingerprint,
  releaseSourceManifestDigest,
  verifyReleaseApprovalDecision,
  type ApprovalVerifier,
  type ReleaseSourceManifest,
} from "../src/approval/release-approval";
import type { ArtifactRecord } from "../src/release/artifact-registry";
import type { ReleaseCandidateManifest } from "../src/release/candidate";

const artifacts: ArtifactRecord[] = [
  { id: "build", projectId: "snake-game", kind: "build", location: "runner/build", producedBy: "local-codex", createdAt: new Date(0).toISOString(), checksum: "sha256:build" },
  { id: "tests", projectId: "snake-game", kind: "test-report", location: "runner/tests", producedBy: "local-codex", createdAt: new Date(0).toISOString(), checksum: "sha256:tests" },
];

const candidate: ReleaseCandidateManifest = {
  projectId: "snake-game",
  status: "blocked",
  blockers: ["explicit human approval required"],
  artifactIds: ["build", "tests"],
  evidenceRefs: ["runner/local-codex/run/1"],
  approvedByHuman: false,
};

const androidBinding = {
  lane: "android" as const,
  sourceKind: "git-object" as const,
  sourceCommitSha: "569cf6a3fea828b8688856ad3f6890c35e065c86",
  sourceObjectPath: "src/implementation/generator.ts",
  sourceObjectSha: "1e471fcaf4aa1006cc51d7eeda842d3ef50e189e",
  materializerId: "snake-capacitor-v1",
};
const iosBinding = {
  lane: "ios" as const,
  sourceKind: "git-object" as const,
  sourceCommitSha: "45735ce8dd3383a69a05524d7f46a7adb66cd116",
  sourceObjectPath: "src/implementation/generator.ts",
  sourceObjectSha: "1e471fcaf4aa1006cc51d7eeda842d3ef50e189e",
  materializerId: "snake-capacitor-v1",
};
const sourceManifest: ReleaseSourceManifest = { schemaVersion: "1", lanes: [androidBinding, iosBinding] };

const verifier: ApprovalVerifier = {
  async verify(_request, attestation) {
    if (attestation.opaqueProof !== "verified-test-proof") return null;
    return { actorId: "owner-1", verifierId: "test-verifier", assurance: "verified" };
  },
};

test("legacy v1 fingerprint remains byte-for-byte compatible when no source manifest is supplied", () => {
  const fingerprint = releaseCandidateFingerprint({
    projectId: "snake-game",
    targetLanes: ["web"],
    artifacts,
    evidenceRefs: ["runner/local-codex/run/1"],
  });
  assert.equal(fingerprint, "sha256:1dcb981e506e3bf743f59cefae585260a972e24dda5459d795b19bb50268561b");
  const request = createReleaseApprovalRequest({
    requestId: "legacy-approval-001",
    projectId: "snake-game",
    targetLanes: ["web"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    requestedAt: "2026-08-15T06:00:00.000Z",
    expiresAt: "2026-08-15T07:00:00.000Z",
  });
  assert.equal(request.schemaVersion, "1");
  assert.equal(request.sourceManifestDigest, undefined);
  assert.equal(request.candidateFingerprint, fingerprint);
});

test("source-bound approval is schema v2 and source changes alter the candidate fingerprint", () => {
  const request = createReleaseApprovalRequest({
    requestId: "source-bound-001",
    projectId: "snake-game",
    targetLanes: ["android", "ios"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    sourceManifest,
    requestedAt: "2026-08-15T06:00:00.000Z",
    expiresAt: "2026-08-15T07:00:00.000Z",
  });
  assert.equal(request.schemaVersion, "2");
  assert.match(request.sourceManifestDigest ?? "", /^sha256:[0-9a-f]{64}$/);
  const changed: ReleaseSourceManifest = {
    ...sourceManifest,
    lanes: sourceManifest.lanes.map((lane) => lane.lane === "android" ? { ...lane, sourceObjectSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } : lane),
  };
  const changedDigest = releaseSourceManifestDigest({ manifest: changed, targetLanes: ["android", "ios"] });
  const changedFingerprint = releaseCandidateFingerprint({
    projectId: "snake-game",
    targetLanes: ["android", "ios"],
    artifacts,
    evidenceRefs: candidate.evidenceRefs,
    sourceManifestDigest: changedDigest,
  });
  assert.notEqual(changedFingerprint, request.candidateFingerprint);
});

test("source manifest must bind each target lane exactly once", () => {
  assert.throws(() => releaseSourceManifestDigest({
    targetLanes: ["android", "ios"],
    manifest: { schemaVersion: "1", lanes: [androidBinding] },
  }), /every approval target lane exactly once/);
  assert.throws(() => releaseSourceManifestDigest({
    targetLanes: ["android"],
    manifest: { schemaVersion: "1", lanes: [androidBinding, androidBinding] },
  }), /Duplicate source manifest lane/);
});

test("v2 verification rejects a missing source manifest digest before verifier acceptance", async () => {
  const request = createReleaseApprovalRequest({
    requestId: "source-bound-002",
    projectId: "snake-game",
    targetLanes: ["android", "ios"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    sourceManifest,
    requestedAt: "2026-08-15T06:00:00.000Z",
    expiresAt: "2026-08-15T07:00:00.000Z",
  });
  await assert.rejects(
    verifyReleaseApprovalDecision({
      request: { ...request, sourceManifestDigest: undefined },
      attestation: {
        requestId: request.requestId,
        candidateFingerprint: request.candidateFingerprint,
        decision: "approve",
        submittedAt: "2026-08-15T06:10:00.000Z",
        opaqueProof: "verified-test-proof",
      },
      verifier,
      verificationTime: "2026-08-15T06:10:01.000Z",
    }),
    /missing a valid source manifest digest/,
  );
});
