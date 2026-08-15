import type { PlatformLane } from "../execution/types";
import type { VerifiedReleaseApprovalDecision } from "../approval/release-approval";
import type { ReleaseCandidateManifest } from "./candidate";

export interface ReleaseCandidatePromotion {
  schemaVersion: "1" | "2";
  releaseCandidateId: string;
  projectId: string;
  version: string;
  candidateFingerprint: string;
  approvalRequestId: string;
  approvedBy: string;
  verifierId: string;
  approvedAt: string;
  promotedAt: string;
  targetLanes: PlatformLane[];
  artifactIds: string[];
  evidenceRefs: string[];
  sourceManifestDigest?: string;
  publicPublishAuthorized: false;
}

const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const SAFE_ID_RE = /^[A-Za-z0-9._:-]+$/;

export function promoteReleaseCandidate(input: {
  releaseCandidateId: string;
  version: string;
  candidateFingerprint: string;
  targetLanes: PlatformLane[];
  candidate: ReleaseCandidateManifest;
  approval: VerifiedReleaseApprovalDecision;
  promotedAt: string;
}): ReleaseCandidatePromotion {
  if (!SAFE_ID_RE.test(input.releaseCandidateId)) throw new Error("Unsafe release candidate id");
  if (!VERSION_RE.test(input.version)) throw new Error("Invalid release candidate version");
  if (!/^sha256:[a-f0-9]{64}$/i.test(input.candidateFingerprint)) throw new Error("Invalid candidate fingerprint");
  if (!input.targetLanes.length) throw new Error("Release candidate target lanes are required");
  if (input.candidate.status !== "ready" || !input.candidate.approvedByHuman) {
    throw new Error("Only a human-approved ready candidate can be promoted");
  }
  if (input.approval.decision !== "approve") throw new Error("Verified approval decision must be approve");
  if (input.approval.projectId !== input.candidate.projectId) throw new Error("Approval project mismatch");
  if (input.approval.candidateFingerprint !== input.candidateFingerprint) throw new Error("Approval fingerprint mismatch");
  if (input.approval.sourceManifestDigest && !/^sha256:[a-f0-9]{64}$/i.test(input.approval.sourceManifestDigest)) {
    throw new Error("Invalid approved source manifest digest");
  }
  if (!input.candidate.artifactIds.length || !input.candidate.evidenceRefs.length) {
    throw new Error("Release candidate promotion requires bound artifacts and evidence");
  }
  const promotedAt = Date.parse(input.promotedAt);
  const approvedAt = Date.parse(input.approval.verifiedAt);
  if (!Number.isFinite(promotedAt) || !Number.isFinite(approvedAt) || promotedAt < approvedAt) {
    throw new Error("Release candidate promotion time must be valid and not precede approval");
  }

  return {
    schemaVersion: input.approval.sourceManifestDigest ? "2" : "1",
    releaseCandidateId: input.releaseCandidateId,
    projectId: input.candidate.projectId,
    version: input.version,
    candidateFingerprint: input.candidateFingerprint,
    approvalRequestId: input.approval.requestId,
    approvedBy: input.approval.actorId,
    verifierId: input.approval.verifierId,
    approvedAt: new Date(approvedAt).toISOString(),
    promotedAt: new Date(promotedAt).toISOString(),
    targetLanes: [...new Set(input.targetLanes)].sort(),
    artifactIds: [...new Set(input.candidate.artifactIds)].sort(),
    evidenceRefs: [...new Set(input.candidate.evidenceRefs)].sort(),
    ...(input.approval.sourceManifestDigest ? { sourceManifestDigest: input.approval.sourceManifestDigest } : {}),
    publicPublishAuthorized: false,
  };
}
