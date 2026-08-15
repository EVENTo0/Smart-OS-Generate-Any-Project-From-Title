import { createHash } from "node:crypto";
import type { PlatformLane } from "../execution/types";
import type { ArtifactRecord } from "../release/artifact-registry";
import type { ReleaseCandidateManifest } from "../release/candidate";
import type { ReleaseReadiness } from "../release/readiness";

export interface ReleaseSourceLaneBinding {
  lane: PlatformLane;
  sourceKind: "git-object";
  sourceCommitSha: string;
  sourceObjectPath: string;
  sourceObjectSha: string;
  materializerId: string;
}

export interface ReleaseSourceManifest {
  schemaVersion: "1";
  lanes: ReleaseSourceLaneBinding[];
}

export interface ReleaseApprovalRequest {
  schemaVersion: "1" | "2";
  requestId: string;
  projectId: string;
  purpose: "release-candidate";
  candidateFingerprint: string;
  targetLanes: PlatformLane[];
  artifactIds: string[];
  evidenceRefs: string[];
  sourceManifestDigest?: string;
  requestedAt: string;
  expiresAt: string;
}

export interface ReleaseApprovalAttestation {
  requestId: string;
  candidateFingerprint: string;
  decision: "approve" | "reject";
  submittedAt: string;
  opaqueProof: string;
}

export interface VerifiedApprovalActor {
  actorId: string;
  verifierId: string;
  assurance: "verified";
}

export interface ApprovalVerifier {
  verify(
    request: ReleaseApprovalRequest,
    attestation: ReleaseApprovalAttestation,
  ): Promise<VerifiedApprovalActor | null>;
}

export interface VerifiedReleaseApprovalDecision {
  schemaVersion: "1";
  requestId: string;
  projectId: string;
  candidateFingerprint: string;
  decision: "approve" | "reject";
  actorId: string;
  verifierId: string;
  verifiedAt: string;
  sourceManifestDigest?: string;
}

function isoMillis(value: string, label: string): number {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`Invalid ${label}`);
  return millis;
}

function safeId(value: string, label: string): string {
  if (!/^[A-Za-z0-9._:-]+$/.test(value)) throw new Error(`Unsafe ${label}`);
  return value;
}

function safeGitSha(value: string, label: string): string {
  if (!/^[a-f0-9]{40}$/i.test(value)) throw new Error(`Invalid ${label}`);
  return value.toLowerCase();
}

function safeRelativePath(value: string): string {
  if (!value || value.startsWith("/") || value.includes("\\") || value.split("/").some((part) => part === ".." || part === "")) {
    throw new Error("Unsafe source object path");
  }
  return value;
}

function stableArtifactBinding(artifacts: ArtifactRecord[]): Array<{
  id: string;
  kind: ArtifactRecord["kind"];
  producedBy: string;
  checksum: string;
}> {
  return artifacts
    .map((artifact) => {
      if (!artifact.checksum?.startsWith("sha256:")) {
        throw new Error(`Release approval requires SHA-256 artifact checksum: ${artifact.id}`);
      }
      return {
        id: artifact.id,
        kind: artifact.kind,
        producedBy: artifact.producedBy,
        checksum: artifact.checksum,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function canonicalSourceManifest(
  manifest: ReleaseSourceManifest,
  targetLanes: PlatformLane[],
): ReleaseSourceManifest {
  if (manifest.schemaVersion !== "1") throw new Error("Unsupported source manifest schema");
  const expected = [...new Set(targetLanes)].sort();
  const seen = new Set<string>();
  const lanes = manifest.lanes.map((binding) => {
    if (seen.has(binding.lane)) throw new Error(`Duplicate source manifest lane: ${binding.lane}`);
    seen.add(binding.lane);
    if (!expected.includes(binding.lane)) throw new Error(`Source manifest lane ${binding.lane} is outside approval scope`);
    return {
      lane: binding.lane,
      sourceKind: "git-object" as const,
      sourceCommitSha: safeGitSha(binding.sourceCommitSha, "source commit SHA"),
      sourceObjectPath: safeRelativePath(binding.sourceObjectPath),
      sourceObjectSha: safeGitSha(binding.sourceObjectSha, "source object SHA"),
      materializerId: safeId(binding.materializerId, "source materializer id"),
    };
  }).sort((a, b) => a.lane.localeCompare(b.lane));
  const actual = lanes.map((binding) => binding.lane).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Source manifest must bind every approval target lane exactly once");
  }
  return { schemaVersion: "1", lanes };
}

export function releaseSourceManifestDigest(input: {
  manifest: ReleaseSourceManifest;
  targetLanes: PlatformLane[];
}): string {
  const canonical = canonicalSourceManifest(input.manifest, input.targetLanes);
  return `sha256:${createHash("sha256").update(JSON.stringify(canonical)).digest("hex")}`;
}

export function releaseCandidateFingerprint(input: {
  projectId: string;
  targetLanes: PlatformLane[];
  artifacts: ArtifactRecord[];
  evidenceRefs: string[];
  sourceManifestDigest?: string;
}): string {
  if (!input.targetLanes.length) throw new Error("Approval target lanes are required");
  if (!input.evidenceRefs.length) throw new Error("Approval evidence references are required");
  if (input.sourceManifestDigest && !/^sha256:[a-f0-9]{64}$/i.test(input.sourceManifestDigest)) {
    throw new Error("Invalid source manifest digest");
  }
  const canonical = JSON.stringify({
    projectId: input.projectId,
    targetLanes: [...new Set(input.targetLanes)].sort(),
    artifacts: stableArtifactBinding(input.artifacts),
    evidenceRefs: [...new Set(input.evidenceRefs)].sort(),
    ...(input.sourceManifestDigest ? { sourceManifestDigest: input.sourceManifestDigest.toLowerCase() } : {}),
  });
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

export function createReleaseApprovalRequest(input: {
  requestId: string;
  projectId: string;
  targetLanes: PlatformLane[];
  artifacts: ArtifactRecord[];
  readiness: ReleaseReadiness;
  candidate: ReleaseCandidateManifest;
  sourceManifest?: ReleaseSourceManifest;
  requestedAt: string;
  expiresAt: string;
}): ReleaseApprovalRequest {
  safeId(input.requestId, "approval request id");
  if (input.candidate.projectId !== input.projectId) throw new Error("Approval project does not match candidate");
  if (!input.readiness.readyForCandidate) throw new Error("Technical release readiness must pass before approval can be requested");
  if (input.candidate.status !== "blocked") throw new Error("Approval request requires an approval-blocked candidate");
  const blockers = [...new Set(input.candidate.blockers)];
  if (blockers.length !== 1 || blockers[0] !== "explicit human approval required") {
    throw new Error("Approval cannot be requested while non-approval blockers remain");
  }

  const requested = isoMillis(input.requestedAt, "requestedAt");
  const expires = isoMillis(input.expiresAt, "expiresAt");
  if (expires <= requested) throw new Error("Approval request expiry must be after request time");

  const artifactIds = [...new Set(input.candidate.artifactIds)].sort();
  const artifacts = input.artifacts.filter((artifact) => artifactIds.includes(artifact.id));
  if (artifacts.length !== artifactIds.length) throw new Error("Candidate artifact set is incomplete");

  const evidenceRefs = [...new Set(input.candidate.evidenceRefs)].sort();
  const sourceManifestDigest = input.sourceManifest
    ? releaseSourceManifestDigest({ manifest: input.sourceManifest, targetLanes: input.targetLanes })
    : undefined;
  const candidateFingerprint = releaseCandidateFingerprint({
    projectId: input.projectId,
    targetLanes: input.targetLanes,
    artifacts,
    evidenceRefs,
    sourceManifestDigest,
  });

  return {
    schemaVersion: sourceManifestDigest ? "2" : "1",
    requestId: input.requestId,
    projectId: input.projectId,
    purpose: "release-candidate",
    candidateFingerprint,
    targetLanes: [...new Set(input.targetLanes)].sort(),
    artifactIds,
    evidenceRefs,
    ...(sourceManifestDigest ? { sourceManifestDigest } : {}),
    requestedAt: new Date(requested).toISOString(),
    expiresAt: new Date(expires).toISOString(),
  };
}

export async function verifyReleaseApprovalDecision(input: {
  request: ReleaseApprovalRequest;
  attestation: ReleaseApprovalAttestation;
  verifier: ApprovalVerifier;
  verificationTime: string;
}): Promise<VerifiedReleaseApprovalDecision> {
  if (input.request.schemaVersion === "2" && !/^sha256:[a-f0-9]{64}$/i.test(input.request.sourceManifestDigest ?? "")) {
    throw new Error("Source-bound approval request is missing a valid source manifest digest");
  }
  if (input.attestation.requestId !== input.request.requestId) throw new Error("Approval request ID mismatch");
  if (input.attestation.candidateFingerprint !== input.request.candidateFingerprint) throw new Error("Approval fingerprint mismatch");
  if (!input.attestation.opaqueProof.trim()) throw new Error("Approval proof is required");

  const verificationTime = isoMillis(input.verificationTime, "verificationTime");
  const submittedAt = isoMillis(input.attestation.submittedAt, "submittedAt");
  const requestedAt = isoMillis(input.request.requestedAt, "requestedAt");
  const expiresAt = isoMillis(input.request.expiresAt, "expiresAt");
  if (submittedAt < requestedAt || submittedAt > expiresAt || verificationTime > expiresAt) {
    throw new Error("Approval request expired or attestation is outside its validity window");
  }

  const actor = await input.verifier.verify(input.request, input.attestation);
  if (!actor || actor.assurance !== "verified") throw new Error("Approval attestation was not verified");
  safeId(actor.actorId, "verified approval actor id");
  safeId(actor.verifierId, "approval verifier id");

  return {
    schemaVersion: "1",
    requestId: input.request.requestId,
    projectId: input.request.projectId,
    candidateFingerprint: input.request.candidateFingerprint,
    decision: input.attestation.decision,
    actorId: actor.actorId,
    verifierId: actor.verifierId,
    verifiedAt: new Date(verificationTime).toISOString(),
    ...(input.request.sourceManifestDigest ? { sourceManifestDigest: input.request.sourceManifestDigest } : {}),
  };
}
