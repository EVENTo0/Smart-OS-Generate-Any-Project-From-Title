import type { ProjectInput } from "./types";
import type { IntakeResult } from "./intake";
import type { ProjectQuestion } from "./questionnaire";
import type { EvidenceLedger } from "../research/types";
import { canBecomeHardRequirement } from "../research/ledger";

export interface ProjectDNA {
  projectId: string;
  title: string;
  domain: string;
  platforms: string[];
  goal: string;
  constraints: string[];
  decisions: Record<string, string>;
  evidenceClaimIds: string[];
  hardRequirements: string[];
  status: "provisional" | "approved";
}

export function makeProjectId(title: string): string {
  const cleaned = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "project";
}

export function compileProjectDNA(input: ProjectInput, intake: IntakeResult, questions: ProjectQuestion[], answers: Record<string, string> = {}, evidence?: EvidenceLedger): ProjectDNA {
  const decisions: Record<string, string> = {};
  for (const question of questions) decisions[question.id] = answers[question.id] ?? question.recommended;
  const platforms = intake.platforms.length > 0 ? intake.platforms : [decisions["primary-platform"] ?? "Web/PWA"];
  const goal = input.description?.trim() || "Build an original project from the supplied idea.";
  const claims = evidence?.claims ?? [];
  return {
    projectId: makeProjectId(intake.title),
    title: intake.title,
    domain: intake.domain,
    platforms,
    goal,
    constraints: intake.constraints,
    decisions,
    evidenceClaimIds: claims.map((claim) => claim.id),
    hardRequirements: claims.filter(canBecomeHardRequirement).map((claim) => claim.text),
    status: "provisional",
  };
}
