import { canBecomeHardRequirement } from "../research/ledger";
import type { EvidenceLedger } from "../research/types";
import type { ComparableSystem, PatternDraft, PatternGraph, PatternNode } from "./types";

function requireUniqueIds(items: { id: string }[], label: string): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    seen.add(item.id);
  }
}

export function buildPatternGraph(
  ledger: EvidenceLedger,
  comparables: ComparableSystem[],
  drafts: PatternDraft[],
): PatternGraph {
  requireUniqueIds(comparables, "comparable");
  requireUniqueIds(drafts, "pattern");

  const claims = new Map(ledger.claims.map((claim) => [claim.id, claim]));
  const comparableIds = new Set(comparables.map((item) => item.id));

  for (const comparable of comparables) {
    if (comparable.referenceOnly !== true) throw new Error(`Comparable ${comparable.id} must be referenceOnly`);
    if (comparable.evidenceClaimIds.length === 0) throw new Error(`Comparable ${comparable.id} requires evidence`);
    for (const claimId of comparable.evidenceClaimIds) {
      if (!claims.has(claimId)) throw new Error(`Comparable ${comparable.id} references unknown claim ${claimId}`);
    }
  }

  const patterns: PatternNode[] = drafts.map((draft) => {
    if (draft.evidenceClaimIds.length === 0) throw new Error(`Pattern ${draft.id} requires evidence`);
    const supportingClaims = draft.evidenceClaimIds.map((claimId) => {
      const claim = claims.get(claimId);
      if (!claim) throw new Error(`Pattern ${draft.id} references unknown claim ${claimId}`);
      return claim;
    });
    for (const comparableId of draft.comparableSystemIds) {
      if (!comparableIds.has(comparableId)) throw new Error(`Pattern ${draft.id} references unknown comparable ${comparableId}`);
    }
    const eligible = supportingClaims.every(canBecomeHardRequirement);
    return { ...draft, status: draft.requestApproval && eligible ? "approved" : "candidate" };
  });

  const edges = patterns.flatMap((pattern) =>
    pattern.comparableSystemIds.map((comparableId) => ({ from: comparableId, to: pattern.id, relation: "supports" as const })),
  );

  return { comparables, patterns, edges };
}
