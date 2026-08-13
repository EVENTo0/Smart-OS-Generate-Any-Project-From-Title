import { createBlueprint } from "./blueprint";
import { generateEvidenceBackedFoundation } from "./orchestrator";
import type { ProjectInput } from "./types";
import type { ResearchClaimExtractor, ResearchSearchProvider } from "../research/adapters";
import { buildPatternGraph } from "../patterns/graph";
import type { ComparableSystem, PatternDraft } from "../patterns/types";
import { persistWorkspace } from "../workspace/store";

export interface Gate3Options {
  workspaceRoot: string;
  comparables: ComparableSystem[];
  patternDrafts: PatternDraft[];
  answers?: Record<string, string>;
}

export async function generatePersistedProject(
  input: ProjectInput,
  searchProvider: ResearchSearchProvider,
  claimExtractor: ResearchClaimExtractor,
  options: Gate3Options,
) {
  const foundation = await generateEvidenceBackedFoundation(input, searchProvider, claimExtractor, options.answers ?? {});
  const patterns = buildPatternGraph(foundation.research.ledger, options.comparables, options.patternDrafts);
  const approved = patterns.patterns.filter((pattern) => pattern.status === "approved").map((pattern) => pattern.description);
  const dna = { ...foundation.dna, hardRequirements: [...new Set([...foundation.dna.hardRequirements, ...approved])] };
  const blueprint = createBlueprint(dna);
  const snapshot = {
    schemaVersion: 1 as const,
    projectId: dna.projectId,
    savedAt: new Date().toISOString(),
    input,
    researchPlan: foundation.researchPlan,
    evidence: foundation.research.ledger,
    patterns,
    questions: foundation.questions,
    answers: options.answers ?? {},
    dna,
    blueprint,
    decisions: dna.decisions,
    verification: { status: "pending" as const, checks: ["evidence-provenance", "pattern-provenance", "workspace-isolation"] },
  };
  const workspacePath = await persistWorkspace(options.workspaceRoot, snapshot);
  return { ...foundation, patterns, dna, blueprint, snapshot, workspacePath };
}
