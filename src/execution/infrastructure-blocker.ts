export type InfrastructureBlockerKind =
  | "billing"
  | "quota"
  | "runner-unavailable"
  | "credentials"
  | "toolchain"
  | "network"
  | "cancelled-by-newer-run"
  | "unknown-infrastructure";

export interface InfrastructureBlocker {
  kind: InfrastructureBlockerKind;
  summary: string;
  retryableWithoutCodeChange: boolean;
  routeToCodingAgent: false;
}

export interface InfrastructureSignal {
  message: string;
  jobStarted?: boolean;
  runnerAllocated?: boolean;
  conclusion?: string | null;
}

const includesAny = (text: string, patterns: string[]) => patterns.some((pattern) => text.includes(pattern));

export function classifyInfrastructureBlocker(signal: InfrastructureSignal): InfrastructureBlocker | null {
  const text = signal.message.toLowerCase();

  if (includesAny(text, ["payment", "billing", "spending limit", "payment method"])) {
    return { kind: "billing", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (includesAny(text, ["quota exceeded", "usage limit", "rate limit", "resource limit"])) {
    return { kind: "quota", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (includesAny(text, ["runner unavailable", "no runner", "waiting for a runner", "runner offline"])) {
    return { kind: "runner-unavailable", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (includesAny(text, ["missing credential", "missing secret", "authentication failed", "unauthorized", "permission denied"])) {
    return { kind: "credentials", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (includesAny(text, ["sdk not found", "toolchain not found", "command not found", "xcode not found", "android sdk not found"])) {
    return { kind: "toolchain", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (includesAny(text, ["network unreachable", "connection timed out", "dns", "temporary failure in name resolution"])) {
    return { kind: "network", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (signal.conclusion === "cancelled" && includesAny(text, ["concurrency", "newer run", "new commit", "superseded"])) {
    return { kind: "cancelled-by-newer-run", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  if (signal.jobStarted === false && signal.runnerAllocated === false) {
    return { kind: "unknown-infrastructure", summary: signal.message, retryableWithoutCodeChange: true, routeToCodingAgent: false };
  }
  return null;
}
