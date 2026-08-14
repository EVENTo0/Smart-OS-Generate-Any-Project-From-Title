import { randomBytes } from "node:crypto";
import {
  verifyReleaseApprovalDecision,
  type ReleaseApprovalAttestation,
  type ReleaseApprovalRequest,
  type VerifiedApprovalActor,
  type VerifiedReleaseApprovalDecision,
} from "./release-approval";

export interface ApprovalChallenge {
  schemaVersion: "1";
  challengeId: string;
  requestId: string;
  candidateFingerprint: string;
  issuedAt: string;
  expiresAt: string;
}

export interface ApprovalChallengeStore {
  put(challenge: ApprovalChallenge): Promise<void>;
  consume(challenge: ApprovalChallenge): Promise<boolean>;
}

export interface ApprovalIdentityVerifier {
  verifyIdentity(input: {
    request: ReleaseApprovalRequest;
    challenge: ApprovalChallenge;
    authorization: string;
  }): Promise<VerifiedApprovalActor | null>;
}

export interface AuthenticatedApprovalSubmission {
  requestId: string;
  candidateFingerprint: string;
  challengeId: string;
  decision: "approve" | "reject";
  submittedAt: string;
  authorization: string;
}

function parseTime(value: string, label: string): number {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error(`Invalid ${label}`);
  return millis;
}

export function createApprovalChallenge(input: {
  request: ReleaseApprovalRequest;
  issuedAt: string;
  expiresAt: string;
}): ApprovalChallenge {
  const issuedAt = parseTime(input.issuedAt, "challenge issuedAt");
  const expiresAt = parseTime(input.expiresAt, "challenge expiresAt");
  const requestExpiresAt = parseTime(input.request.expiresAt, "approval request expiresAt");
  if (expiresAt <= issuedAt) throw new Error("Approval challenge expiry must be after issue time");
  if (expiresAt > requestExpiresAt) throw new Error("Approval challenge cannot outlive approval request");

  return {
    schemaVersion: "1",
    challengeId: randomBytes(24).toString("base64url"),
    requestId: input.request.requestId,
    candidateFingerprint: input.request.candidateFingerprint,
    issuedAt: new Date(issuedAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export async function processAuthenticatedApproval(input: {
  request: ReleaseApprovalRequest;
  challenge: ApprovalChallenge;
  submission: AuthenticatedApprovalSubmission;
  challengeStore: ApprovalChallengeStore;
  identityVerifier: ApprovalIdentityVerifier;
  verificationTime: string;
}): Promise<VerifiedReleaseApprovalDecision> {
  const { request, challenge, submission } = input;
  if (challenge.requestId !== request.requestId || submission.requestId !== request.requestId) {
    throw new Error("Authenticated approval request binding mismatch");
  }
  if (challenge.candidateFingerprint !== request.candidateFingerprint || submission.candidateFingerprint !== request.candidateFingerprint) {
    throw new Error("Authenticated approval fingerprint mismatch");
  }
  if (submission.challengeId !== challenge.challengeId) throw new Error("Authenticated approval challenge mismatch");
  if (!submission.authorization.trim()) throw new Error("Authenticated approval authorization is required");

  const verificationTime = parseTime(input.verificationTime, "verificationTime");
  const challengeIssuedAt = parseTime(challenge.issuedAt, "challenge issuedAt");
  const challengeExpiresAt = parseTime(challenge.expiresAt, "challenge expiresAt");
  const submittedAt = parseTime(submission.submittedAt, "submittedAt");
  if (submittedAt < challengeIssuedAt || submittedAt > challengeExpiresAt || verificationTime > challengeExpiresAt) {
    throw new Error("Approval challenge expired or submission is outside its validity window");
  }

  const actor = await input.identityVerifier.verifyIdentity({
    request,
    challenge,
    authorization: submission.authorization,
  });
  if (!actor || actor.assurance !== "verified") throw new Error("Approval identity was not verified");

  const consumed = await input.challengeStore.consume(challenge);
  if (!consumed) throw new Error("Approval challenge was already consumed or is unknown");

  const attestation: ReleaseApprovalAttestation = {
    requestId: request.requestId,
    candidateFingerprint: request.candidateFingerprint,
    decision: submission.decision,
    submittedAt: submission.submittedAt,
    opaqueProof: `authenticated-gateway:${challenge.challengeId}`,
  };

  return verifyReleaseApprovalDecision({
    request,
    attestation,
    verificationTime: input.verificationTime,
    verifier: {
      async verify() {
        return actor;
      },
    },
  });
}
