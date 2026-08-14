import test from "node:test";
import assert from "node:assert/strict";
import {
  createApprovalChallenge,
  processAuthenticatedApproval,
  type ApprovalChallenge,
  type ApprovalChallengeStore,
  type ApprovalIdentityVerifier,
} from "../src/approval/authenticated-gateway";
import type { ReleaseApprovalRequest } from "../src/approval/release-approval";

const request: ReleaseApprovalRequest = {
  schemaVersion: "1",
  requestId: "approval-001",
  projectId: "snake-game",
  purpose: "release-candidate",
  candidateFingerprint: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  targetLanes: ["web"],
  artifactIds: ["build", "tests"],
  evidenceRefs: ["runner/local-codex/run/1"],
  requestedAt: "2026-08-14T16:00:00.000Z",
  expiresAt: "2026-08-14T17:00:00.000Z",
};

class MemoryChallengeStore implements ApprovalChallengeStore {
  private readonly values = new Set<string>();
  async put(challenge: ApprovalChallenge): Promise<void> {
    this.values.add(challenge.challengeId);
  }
  async consume(challenge: ApprovalChallenge): Promise<boolean> {
    if (!this.values.has(challenge.challengeId)) return false;
    this.values.delete(challenge.challengeId);
    return true;
  }
}

const identityVerifier: ApprovalIdentityVerifier = {
  async verifyIdentity({ authorization }) {
    if (authorization !== "valid-session-token") return null;
    return { actorId: "owner-1", verifierId: "auth-adapter-test", assurance: "verified" };
  },
};

test("authenticated approval succeeds once and replay is rejected", async () => {
  const store = new MemoryChallengeStore();
  const challenge = createApprovalChallenge({
    request,
    issuedAt: "2026-08-14T16:05:00.000Z",
    expiresAt: "2026-08-14T16:20:00.000Z",
  });
  await store.put(challenge);

  const submission = {
    requestId: request.requestId,
    candidateFingerprint: request.candidateFingerprint,
    challengeId: challenge.challengeId,
    decision: "approve" as const,
    submittedAt: "2026-08-14T16:10:00.000Z",
    authorization: "valid-session-token",
  };

  const decision = await processAuthenticatedApproval({
    request,
    challenge,
    submission,
    challengeStore: store,
    identityVerifier,
    verificationTime: "2026-08-14T16:10:01.000Z",
  });
  assert.equal(decision.decision, "approve");
  assert.equal(decision.actorId, "owner-1");

  await assert.rejects(
    processAuthenticatedApproval({
      request,
      challenge,
      submission,
      challengeStore: store,
      identityVerifier,
      verificationTime: "2026-08-14T16:10:02.000Z",
    }),
    /already consumed|unknown/,
  );
});

test("invalid identity does not become a verified release decision", async () => {
  const store = new MemoryChallengeStore();
  const challenge = createApprovalChallenge({
    request,
    issuedAt: "2026-08-14T16:05:00.000Z",
    expiresAt: "2026-08-14T16:20:00.000Z",
  });
  await store.put(challenge);

  await assert.rejects(
    processAuthenticatedApproval({
      request,
      challenge,
      submission: {
        requestId: request.requestId,
        candidateFingerprint: request.candidateFingerprint,
        challengeId: challenge.challengeId,
        decision: "approve",
        submittedAt: "2026-08-14T16:10:00.000Z",
        authorization: "untrusted-browser-assertion",
      },
      challengeStore: store,
      identityVerifier,
      verificationTime: "2026-08-14T16:10:01.000Z",
    }),
    /identity was not verified/,
  );
});

test("expired approval challenge is rejected before authorization", async () => {
  const store = new MemoryChallengeStore();
  const challenge = createApprovalChallenge({
    request,
    issuedAt: "2026-08-14T16:05:00.000Z",
    expiresAt: "2026-08-14T16:06:00.000Z",
  });
  await store.put(challenge);

  await assert.rejects(
    processAuthenticatedApproval({
      request,
      challenge,
      submission: {
        requestId: request.requestId,
        candidateFingerprint: request.candidateFingerprint,
        challengeId: challenge.challengeId,
        decision: "approve",
        submittedAt: "2026-08-14T16:07:00.000Z",
        authorization: "valid-session-token",
      },
      challengeStore: store,
      identityVerifier,
      verificationTime: "2026-08-14T16:07:01.000Z",
    }),
    /expired|validity window/,
  );
});
