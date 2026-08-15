import test from "node:test";
import assert from "node:assert/strict";
import { createSecureSigningRequest } from "../src/signing/secure-signing-broker";
import { evaluateSigningExecutionPreflight } from "../src/signing/signing-preflight";
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

test("Android signing preflight becomes ready using references only", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-android-rc2",
    promotion,
    lane: "android",
    runnerId: "secure-android-runner",
    provider: "external-vault",
  });
  const refs = request.secretRefs.map((ref) => ref.name);
  const result = evaluateSigningExecutionPreflight({
    request,
    runner: {
      runnerId: "secure-android-runner",
      hostPlatform: "linux",
      lanes: ["android"],
      tools: ["gradle", "jarsigner"],
      secretProviders: ["external-vault"],
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    },
    secretCatalog: { provider: "external-vault", availableRefs: refs, exposesSecretValues: false },
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.missingSecretRefs, []);
  assert.equal(result.publicPublishAuthorized, false);
  assert.equal(result.storeUploadAuthorized, false);
});

test("iOS signing preflight requires macOS and reports missing references without values", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-ios-rc2",
    promotion,
    lane: "ios",
    runnerId: "wrong-host",
    provider: "github-actions",
  });
  const result = evaluateSigningExecutionPreflight({
    request,
    runner: {
      runnerId: "wrong-host",
      hostPlatform: "linux",
      lanes: ["ios"],
      tools: ["xcodebuild", "security"],
      secretProviders: ["github-actions"],
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    },
    secretCatalog: { provider: "github-actions", availableRefs: [], exposesSecretValues: false },
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("ios-requires-macos"));
  assert.ok(result.blockers.includes("missing-signing-secret-references"));
  assert.deepEqual(result.missingSecretRefs.sort(), [
    "APPLE_DEVELOPMENT_TEAM_ID",
    "APPLE_PROVISIONING_PROFILE",
    "APPLE_SIGNING_CERTIFICATE",
    "APPLE_SIGNING_CERTIFICATE_PASSWORD",
  ].sort());
});
