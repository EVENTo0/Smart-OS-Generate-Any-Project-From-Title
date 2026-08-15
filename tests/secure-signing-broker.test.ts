import test from "node:test";
import assert from "node:assert/strict";
import { createSecureSigningRequest, evaluateSigningReadiness } from "../src/signing/secure-signing-broker";
import type { ReleaseCandidatePromotion } from "../src/release/promotion";

const promotion: ReleaseCandidatePromotion = {
  schemaVersion: "1",
  releaseCandidateId: "2fe3775d-f2c4-43c7-8611-0995df7b90b0",
  projectId: "snake-game",
  version: "0.1.0-rc.2",
  candidateFingerprint: "sha256:82944e75cf40c7ff3276d9c72581cc5ef117e414614db2bfcf1a840bbf1adec0",
  approvalRequestId: "9eb1dedf-a473-42da-9b7d-6a1ac41f9fc4",
  approvedBy: "1dc3870b-8502-4d3f-9788-ca50639104d5",
  verifierId: "supabase-auth-edge",
  approvedAt: "2026-08-15T04:27:28.747Z",
  promotedAt: "2026-08-15T04:29:26.169Z",
  targetLanes: ["android", "ios"],
  artifactIds: ["android-build", "ios-build"],
  evidenceRefs: ["android-runtime", "ios-runtime"],
  publicPublishAuthorized: false,
};

test("secure signing request contains references only and never authorizes store publishing", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-android-rc2",
    promotion,
    lane: "android",
    runnerId: "secure-android-runner",
    provider: "github-actions",
  });

  assert.equal(request.policy.browserCanResolveSecrets, false);
  assert.equal(request.policy.serializeSecretValues, false);
  assert.equal(request.policy.publicPublishAuthorized, false);
  assert.equal(request.policy.storeUploadAuthorized, false);
  assert.equal(request.command.executable, "./gradlew");
  assert.ok(request.secretRefs.every((ref) => ref.name.startsWith("ANDROID_")));
  assert.equal(JSON.stringify(request).includes("secretValue"), false);
});

test("signing readiness reports only missing secret reference names", () => {
  const request = createSecureSigningRequest({
    requestId: "sign-ios-rc2",
    promotion,
    lane: "ios",
    runnerId: "secure-macos-runner",
    provider: "external-vault",
  });
  const readiness = evaluateSigningReadiness(request, ["APPLE_DEVELOPMENT_TEAM_ID"]);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.missingSecretRefs, ["APPLE_SIGNING_CERTIFICATE", "APPLE_PROVISIONING_PROFILE"]);
  assert.equal(readiness.publicPublishAuthorized, false);
  assert.equal(readiness.storeUploadAuthorized, false);
});

test("signing cannot escape the approved target lanes", () => {
  const webOnly = { ...promotion, targetLanes: ["web"] } as ReleaseCandidatePromotion;
  assert.throws(
    () => createSecureSigningRequest({
      requestId: "bad-signing-request",
      promotion: webOnly,
      lane: "android",
      runnerId: "secure-android-runner",
      provider: "secure-local-runner",
    }),
    /outside the approved release candidate scope/,
  );
});
