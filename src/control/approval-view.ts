import type { ReleaseApprovalRequest } from "../approval/release-approval";

export interface ControlApprovalView {
  schemaVersion: "1";
  approvalSchemaVersion: "1" | "2";
  requestId: string;
  projectId: string;
  candidateFingerprint: string;
  targetLanes: string[];
  artifactCount: number;
  evidenceCount: number;
  sourceBound: boolean;
  requestedAt: string;
  expiresAt: string;
  status: "pending-verification";
  browserCanSelfApprove: false;
  containsVerifierCredential: false;
  containsOpaqueProof: false;
}

export function createControlApprovalView(request: ReleaseApprovalRequest): ControlApprovalView {
  return {
    schemaVersion: "1",
    approvalSchemaVersion: request.schemaVersion,
    requestId: request.requestId,
    projectId: request.projectId,
    candidateFingerprint: request.candidateFingerprint,
    targetLanes: [...request.targetLanes],
    artifactCount: request.artifactIds.length,
    evidenceCount: request.evidenceRefs.length,
    sourceBound: request.schemaVersion === "2",
    requestedAt: request.requestedAt,
    expiresAt: request.expiresAt,
    status: "pending-verification",
    browserCanSelfApprove: false,
    containsVerifierCredential: false,
    containsOpaqueProof: false,
  };
}
