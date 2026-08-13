import type { ProjectInput } from "../core/types";
import type { ProjectQuestion } from "../core/questionnaire";
import type { ProjectDNA } from "../core/dna";
import type { ProjectBlueprint } from "../core/blueprint";
import type { ResearchPlan } from "../research/planner";
import type { EvidenceLedger } from "../research/types";
import type { PatternGraph } from "../patterns/types";

export interface WorkspaceVerification {
  status: "pending" | "passed" | "failed";
  checks: string[];
}

export interface ProjectWorkspaceSnapshot {
  schemaVersion: 1;
  projectId: string;
  savedAt: string;
  input: ProjectInput;
  researchPlan: ResearchPlan;
  evidence: EvidenceLedger;
  patterns: PatternGraph;
  questions: ProjectQuestion[];
  answers: Record<string, string>;
  dna: ProjectDNA;
  blueprint: ProjectBlueprint;
  decisions: Record<string, string>;
  verification: WorkspaceVerification;
}
