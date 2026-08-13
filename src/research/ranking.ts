import type { SourceTier } from "./types";

export interface SourceCandidate {
  url: string;
  title: string;
  publisher?: string;
  snippet?: string;
  declaredTier?: SourceTier;
}

export function rankSource(candidate: SourceCandidate): SourceTier {
  if (candidate.declaredTier) return candidate.declaredTier;
  const host = (() => { try { return new URL(candidate.url).hostname.toLowerCase(); } catch { return ""; } })();
  if (host.endsWith(".gov") || host.endsWith(".edu")) return 2;
  if (host.includes("docs.") || host.includes("developer.") || host.includes("support.")) return 2;
  return 4;
}

export function rankCandidates(candidates: SourceCandidate[]): SourceCandidate[] {
  return [...candidates].sort((a, b) => rankSource(a) - rankSource(b));
}
