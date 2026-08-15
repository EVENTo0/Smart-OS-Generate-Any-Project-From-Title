import test from "node:test";
import assert from "node:assert/strict";
import { selectSigningEnvironment } from "../src/signing/signing-environment-registry";

test("GitHub-hosted signing stays blocked when billing prevents runner start and secrets cannot be verified", () => {
  const result = selectSigningEnvironment({
    lane: "android",
    providers: [{
      handleId: "github-actions-android",
      provider: "github-actions",
      lane: "android",
      requiredSecretRefs: [
        "ANDROID_UPLOAD_KEYSTORE",
        "ANDROID_UPLOAD_KEYSTORE_PASSWORD",
        "ANDROID_UPLOAD_KEY_ALIAS",
        "ANDROID_UPLOAD_KEY_PASSWORD",
      ],
      verification: "access-denied",
      exposesSecretValues: false,
    }],
    runners: [{
      runnerId: "github-hosted-linux",
      lane: "android",
      hostPlatform: "linux",
      tools: ["gradle"],
      state: "blocked",
      blocker: { category: "billing", message: "GitHub Actions job did not start" },
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    }],
  });
  assert.equal(result.ready, false);
  assert.ok(result.blockers.includes("signing-secret-references-cannot-be-verified"));
  assert.ok(result.blockers.includes("github-hosted-linux:billing"));
  assert.equal(result.publicPublishAuthorized, false);
});

test("self-hosted macOS can be selected only after provider verification and runner availability", () => {
  const result = selectSigningEnvironment({
    lane: "ios",
    providers: [{
      handleId: "secure-local-ios",
      provider: "secure-local-runner",
      lane: "ios",
      requiredSecretRefs: ["APPLE_DEVELOPMENT_TEAM_ID", "APPLE_SIGNING_CERTIFICATE", "APPLE_PROVISIONING_PROFILE"],
      verification: "verified",
      exposesSecretValues: false,
    }],
    runners: [{
      runnerId: "self-hosted-macos",
      lane: "ios",
      hostPlatform: "macos",
      tools: ["xcodebuild"],
      state: "available",
      workspaceOnly: true,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    }],
  });
  assert.equal(result.ready, true);
  assert.equal(result.providerHandleId, "secure-local-ios");
  assert.equal(result.runnerId, "self-hosted-macos");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.storeUploadAuthorized, false);
});
