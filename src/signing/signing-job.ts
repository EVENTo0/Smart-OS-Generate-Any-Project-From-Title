import type { SigningLane, SigningSecretProvider, SecureSigningRequest } from "./secure-signing-broker";

export interface SigningProviderHandle {
  handleId: string;
  provider: SigningSecretProvider;
  lane: SigningLane;
  secretRefs: string[];
  active: true;
  exposesSecretValues: false;
}

export interface SigningRunnerAttestation {
  attestationId: string;
  runnerId: string;
  lane: SigningLane;
  hostPlatform: "linux" | "macos" | "windows";
  tools: string[];
  providerHandleId: string;
  workspaceOnly: true;
  publicPublishAuthorized: false;
  storeUploadAuthorized: false;
  attestedAt: string;
  expiresAt: string;
}

export interface IssuedSigningJob {
  schemaVersion: "1";
  jobId: string;
  requestId: string;
  projectId: string;
  releaseCandidateId: string;
  version: string;
  candidateFingerprint: string;
  lane: SigningLane;
  runnerId: string;
  providerHandleId: string;
  attestationId: string;
  command: SecureSigningRequest["command"];
  outputPath: string;
  secretRefs: string[];
  policy: {
    resolveByReferenceOnly: true;
    serializeSecretValues: false;
    publicPublishAuthorized: false;
    storeUploadAuthorized: false;
  };
}

const SAFE_ID = /^[A-Za-z0-9._:-]+$/;

export function issueSigningJob(input: {
  jobId: string;
  request: SecureSigningRequest;
  providerHandle: SigningProviderHandle;
  runnerAttestation: SigningRunnerAttestation;
  issuedAt: string;
}): IssuedSigningJob {
  const { jobId, request, providerHandle, runnerAttestation } = input;
  if (!SAFE_ID.test(jobId)) throw new Error("Unsafe signing job id");
  if (!providerHandle.active || providerHandle.exposesSecretValues !== false) {
    throw new Error("Signing provider handle must be active and reference-only");
  }
  if (providerHandle.lane !== request.lane) throw new Error("Signing provider lane mismatch");
  const requestedProviders = [...new Set(request.secretRefs.map((ref) => ref.provider))];
  if (requestedProviders.length !== 1 || requestedProviders[0] !== providerHandle.provider) {
    throw new Error("Signing provider mismatch");
  }
  const available = new Set(providerHandle.secretRefs);
  const missing = request.secretRefs.map((ref) => ref.name).filter((name) => !available.has(name));
  if (missing.length) throw new Error(`Signing provider handle is missing references: ${missing.join(",")}`);

  if (runnerAttestation.runnerId !== request.runnerId) throw new Error("Signing runner mismatch");
  if (runnerAttestation.lane !== request.lane) throw new Error("Signing runner lane mismatch");
  if (runnerAttestation.providerHandleId !== providerHandle.handleId) throw new Error("Signing provider handle attestation mismatch");
  if (request.lane === "ios" && runnerAttestation.hostPlatform !== "macos") throw new Error("iOS signing requires a macOS attestation");
  if (!runnerAttestation.workspaceOnly || runnerAttestation.publicPublishAuthorized !== false || runnerAttestation.storeUploadAuthorized !== false) {
    throw new Error("Signing runner attestation violates restricted execution policy");
  }
  const issuedAt = Date.parse(input.issuedAt);
  const attestedAt = Date.parse(runnerAttestation.attestedAt);
  const expiresAt = Date.parse(runnerAttestation.expiresAt);
  if (![issuedAt, attestedAt, expiresAt].every(Number.isFinite) || issuedAt < attestedAt || issuedAt >= expiresAt) {
    throw new Error("Signing runner attestation is not valid at issuance time");
  }

  return {
    schemaVersion: "1",
    jobId,
    requestId: request.requestId,
    projectId: request.projectId,
    releaseCandidateId: request.releaseCandidateId,
    version: request.version,
    candidateFingerprint: request.candidateFingerprint,
    lane: request.lane,
    runnerId: request.runnerId,
    providerHandleId: providerHandle.handleId,
    attestationId: runnerAttestation.attestationId,
    command: { ...request.command, args: [...request.command.args] },
    outputPath: request.outputPath,
    secretRefs: request.secretRefs.map((ref) => ref.name),
    policy: {
      resolveByReferenceOnly: true,
      serializeSecretValues: false,
      publicPublishAuthorized: false,
      storeUploadAuthorized: false,
    },
  };
}
