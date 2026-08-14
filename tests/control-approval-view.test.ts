import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { materializeApprovalRequest } from "../src/control/materialize-approval";
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

test("materialized phone approval request never contains verifier proof or self-approval authority", async () => {
  const repositoryRoot = await mkdtemp(join(tmpdir(), "smart-os-approval-"));
  const result = await materializeApprovalRequest({ repositoryRoot, request });
  const materialized = JSON.parse(await readFile(result.path, "utf8"));

  assert.equal(materialized.requestId, "approval-001");
  assert.equal(materialized.browserCanSelfApprove, false);
  assert.equal(materialized.containsVerifierCredential, false);
  assert.equal(materialized.containsOpaqueProof, false);
  assert.equal(JSON.stringify(materialized).includes("opaqueProof"), false);
  assert.equal(JSON.stringify(materialized).includes("verifierCredential"), false);
});
