import test from "node:test";
import assert from "node:assert/strict";
import {
  createReleaseApprovalRequest,
  verifyReleaseApprovalDecision,
  type ApprovalVerifier,
} from "../src/approval/release-approval";
import { applyVerifiedReleaseDecision } from "../src/release/verified-approval";
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

const verifier: ApprovalVerifier = {
  async verify(_request, attestation) {
    if (attestation.opaqueProof !== "verified-test-proof") return null;
    return { actorId: "owner-1", verifierId: "test-verifier", assurance: "verified" };
  },
};

test("verified approval is scoped to the exact release candidate fingerprint", async () => {
  const request = createReleaseApprovalRequest({
    requestId: "approval-001",
    projectId: "snake-game",
    targetLanes: ["web"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    requestedAt: "2026-08-14T16:00:00.000Z",
    expiresAt: "2026-08-14T17:00:00.000Z",
  });

  assert.match(request.candidateFingerprint, /^sha256:/);
  const decision = await verifyReleaseApprovalDecision({
    request,
    attestation: {
      requestId: request.requestId,
      candidateFingerprint: request.candidateFingerprint,
      decision: "approve",
      submittedAt: "2026-08-14T16:10:00.000Z",
      opaqueProof: "verified-test-proof",
    },
    verifier,
    verificationTime: "2026-08-14T16:10:01.000Z",
  });

  const approved = applyVerifiedReleaseDecision({ candidate, request, decision });
  assert.equal(approved.status, "ready");
  assert.equal(approved.approvedByHuman, true);
  assert.deepEqual(approved.blockers, []);
  assert.equal(approved.approval?.actorId, "owner-1");
});

test("approval cannot clear a candidate whose artifact binding changed", async () => {
  const request = createReleaseApprovalRequest({
    requestId: "approval-002",
    projectId: "snake-game",
    targetLanes: ["web"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    requestedAt: "2026-08-14T16:00:00.000Z",
    expiresAt: "2026-08-14T17:00:00.000Z",
  });
  const decision = await verifyReleaseApprovalDecision({
    request,
    attestation: {
      requestId: request.requestId,
      candidateFingerprint: request.candidateFingerprint,
      decision: "approve",
      submittedAt: "2026-08-14T16:10:00.000Z",
      opaqueProof: "verified-test-proof",
    },
    verifier,
    verificationTime: "2026-08-14T16:10:01.000Z",
  });

  assert.throws(() => applyVerifiedReleaseDecision({
    candidate: { ...candidate, artifactIds: ["build", "tests", "changed"] },
    request,
    decision,
  }), /artifacts changed/);
});

test("browser-style self assertion is insufficient without verifier acceptance", async () => {
  const request = createReleaseApprovalRequest({
    requestId: "approval-003",
    projectId: "snake-game",
    targetLanes: ["web"],
    artifacts,
    readiness: { score: 100, readyForCandidate: true, blockers: [], requiredHumanApproval: true },
    candidate,
    requestedAt: "2026-08-14T16:00:00.000Z",
    expiresAt: "2026-08-14T17:00:00.000Z",
  });

  await assert.rejects(
    verifyReleaseApprovalDecision({
      request,
      attestation: {
        requestId: request.requestId,
        candidateFingerprint: request.candidateFingerprint,
        decision: "approve",
        submittedAt: "2026-08-14T16:10:00.000Z",
        opaqueProof: "browser-says-approved",
      },
      verifier,
      verificationTime: "2026-08-14T16:10:01.000Z",
    }),
    /not verified/,
  );
});
