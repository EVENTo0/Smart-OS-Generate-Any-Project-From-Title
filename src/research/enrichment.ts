import type { ProjectQuestion } from "../core/questionnaire";
import type { EvidenceLedger } from "./types";

export interface EvidenceEnrichedQuestion extends ProjectQuestion {
  evidenceClaimIds: string[];
}

export function enrichQuestionnaire(questions: ProjectQuestion[], ledger: EvidenceLedger): EvidenceEnrichedQuestion[] {
  return questions.map((question) => {
    const tag = `question:${question.id}`;
    const evidenceClaimIds = ledger.claims
      .filter((claim) => claim.tags?.includes(tag) && claim.confidence !== "low")
      .map((claim) => claim.id);
    return { ...question, evidenceClaimIds };
  });
}
