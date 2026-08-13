import type { Confidence, EvidenceClaim, EvidenceLedger, SourceRecord } from "./types";

export function createEvidenceLedger(): EvidenceLedger {
  return { sources: [], claims: [] };
}

export function addSource(ledger: EvidenceLedger, source: SourceRecord): EvidenceLedger {
  if (ledger.sources.some((item) => item.id === source.id || item.url === source.url)) return ledger;
  return { ...ledger, sources: [...ledger.sources, source] };
}

export function deriveConfidence(sourceIds: string[], ledger: EvidenceLedger): Confidence {
  const sources = sourceIds.map((id) => ledger.sources.find((source) => source.id === id)).filter(Boolean) as SourceRecord[];
  if (sources.some((source) => source.tier <= 2) || sources.filter((source) => source.tier <= 3).length >= 2) return "high";
  if (sources.some((source) => source.tier <= 4)) return "medium";
  return "low";
}

export function addClaim(ledger: EvidenceLedger, claim: Omit<EvidenceClaim, "confidence"> & { confidence?: Confidence }): EvidenceLedger {
  if ((claim.kind === "fact" || claim.kind === "inference") && claim.sourceIds.length === 0) {
    throw new Error(`Research-derived claim ${claim.id} requires sourceIds`);
  }
  const confidence = claim.confidence ?? deriveConfidence(claim.sourceIds, ledger);
  return { ...ledger, claims: [...ledger.claims, { ...claim, confidence }] };
}

export function canBecomeHardRequirement(claim: EvidenceClaim): boolean {
  if (claim.kind === "user-decision") return true;
  if (claim.kind === "fact") return claim.sourceIds.length > 0 && claim.confidence !== "low";
  if (claim.kind === "inference") return claim.sourceIds.length >= 2 && claim.confidence === "high";
  return false;
}
