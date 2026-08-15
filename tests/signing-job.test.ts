import test from "node:test";
import assert from "node:assert/strict";
import { createSecureSigningRequest } from "../src/signing/secure-signing-broker";
import { issueSigningJob } from "../src/signing/signing-job";
import type { ReleaseCandidatePromotion } from "../src/release/promotion";

const promotion: ReleaseCandidatePromotion = {
  schemaVersion: "1",
  releaseCandidateId: "snake-0.1.0-rc.2",
  projectId: "snake-game",
  version: "0.1.0-rc.2",
  candidateFingerprint: "sha256:82944e75cf40c7ff3276d9c72581cc5ef117e414614db2bfcf1a840bbf1adec0",
  approvalRequestId: "9eb1dedf-a473-42da-9b7d-6a1ac41f9fc4",
  approvedBy: "approver",
  verifierId: "supabase-auth-edge",
  approvedAt: "2026-08-15T04:27:28.747Z",
  promotedAt: "2026-08-15T04:29:26.169Z",
  targetLanes: ["android", "ios"],
  artifactIds: ["artifact"],
  evidenceRefs: ["evidence"],
  publicPublishAuthorized: false,
};

test("issues a restricted Android signing job using provider references only", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-android-rc2",
    promotion,
    lane: "android",
    runnerId: "secure-android-runner",
    provider: "external-vault",
  });
  const job = issueSigningJob({
    jobId: "job-android-rc2",
    request,
    providerHandle: {
      handleId: "android-vault-handle",
      provider: "external-vault",
      lane: "android",
      secretRefs: request.secretRefs.map((ref) => ref.name),
      active: true,
      exposesSecretValues: false,
    },
    runnerAttestation: {
      attestationId: "attest-android-1",
      runnerId: "secure-android-runner",
      lane: "android",
      hostPlatform: "linux",
      tools: ["gradle"],
      providerHandleId: "android-vault-handle",
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
      attestedAt: "2026-08-15T05:00:00Z",
      expiresAt: "2026-08-15T06:00:00Z",
    },
    issuedAt: "2026-08-15T05:30:00Z",
  });
  assert.equal(job.policy.resolveByReferenceOnly, true);
  assert.equal(job.policy.serializeSecretValues, false);
  assert.equal(job.policy.publicPublishAuthorized, false);
  assert.equal(job.policy.storeUploadAuthorized, false);
  assert.ok(job.secretRefs.includes("ANDROID_UPLOAD_KEYSTORE"));
});

test("rejects an iOS signing job when runner attestation is not macOS", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-ios-rc2",
    promotion,
    lane: "ios",
    runnerId: "ios-runner",
    provider: "external-vault",
  });
  assert.throws(() => issueSigningJob({
    jobId: "job-ios-rc2",
    request,
    providerHandle: {
      handleId: "ios-vault-handle",
      provider: "external-vault",
      lane: "ios",
      secretRefs: request.secretRefs.map((ref) => ref.name),
      active: true,
      exposesSecretValues: false,
    },
    runnerAttestation: {
      attestationId: "attest-ios-1",
      runnerId: "ios-runner",
      lane: "ios",
      hostPlatform: "linux",
      tools: ["xcodebuild"],
      providerHandleId: "ios-vault-handle",
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
      attestedAt: "2026-08-15T05:00:00Z",
      expiresAt: "2026-08-15T06:00:00Z",
    },
    issuedAt: "2026-08-15T05:30:00Z",
  }), /macOS/);
});
