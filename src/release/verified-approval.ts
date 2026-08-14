import type {
  ReleaseApprovalRequest,
  VerifiedReleaseApprovalDecision,
} from "../approval/release-approval";
import type { ReleaseCandidateManifest } from "./candidate";

function sameSet(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export interface ApprovalBoundReleaseCandidate extends ReleaseCandidateManifest {
  approval?: {
    requestId: string;
    candidateFingerprint: string;
    decision: "approve" | "reject";
    actorId: string;
    verifierId: string;
    verifiedAt: string;
  };
}

export function applyVerifiedReleaseDecision(input: {
  candidate: ReleaseCandidateManifest;
  request: ReleaseApprovalRequest;
  decision: VerifiedReleaseApprovalDecision;
}): ApprovalBoundReleaseCandidate {
  const { candidate, request, decision } = input;
  if (candidate.projectId !== request.projectId || decision.projectId !== request.projectId) {
    throw new Error("Approval project binding mismatch");
  }
  if (decision.requestId !== request.requestId) throw new Error("Verified decision request mismatch");
  if (decision.candidateFingerprint !== request.candidateFingerprint) {
    throw new Error("Verified decision fingerprint mismatch");
  }
  if (!sameSet(candidate.artifactIds, request.artifactIds)) {
    throw new Error("Release candidate artifacts changed after approval request");
  }
  if (!sameSet(candidate.evidenceRefs, request.evidenceRefs)) {
    throw new Error("Release candidate evidence changed after approval request");
  }

  const nonApprovalBlockers = candidate.blockers.filter((blocker) => blocker !== "explicit human approval required");
  if (nonApprovalBlockers.length) {
    throw new Error("Release candidate has blockers that cannot be cleared by approval");
  }

  const approval = {
    requestId: request.requestId,
    candidateFingerprint: request.candidateFingerprint,
    decision: decision.decision,
    actorId: decision.actorId,
    verifierId: decision.verifierId,
    verifiedAt: decision.verifiedAt,
  };

  if (decision.decision === "reject") {
    return {
      ...candidate,
      status: "blocked",
      blockers: ["human release approval rejected"],
      approvedByHuman: false,
      approval,
    };
  }

  return {
    ...candidate,
    status: "ready",
    blockers: [],
    approvedByHuman: true,
    approval,
  };
}
