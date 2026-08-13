import type { ProjectInput } from "./types";
import { runIntake } from "./intake";
import { generateQuestionnaire } from "./questionnaire";
import { compileProjectDNA } from "./dna";
import { createBlueprint } from "./blueprint";
import { createResearchPlan } from "../research/planner";
import { executeResearchPlan } from "../research/engine";
import { enrichQuestionnaire } from "../research/enrichment";
import type { ResearchClaimExtractor, ResearchSearchProvider } from "../research/adapters";

export function generateProjectFoundation(input: ProjectInput, answers: Record<string, string> = {}) {
  const intake = runIntake(input);
  const questions = generateQuestionnaire(input, intake.domain);
  const dna = compileProjectDNA(input, intake, questions, answers);
  const blueprint = createBlueprint(dna);
  return { intake, questions, dna, blueprint };
}

export async function generateEvidenceBackedFoundation(
  input: ProjectInput,
  searchProvider: ResearchSearchProvider,
  claimExtractor: ResearchClaimExtractor,
  answers: Record<string, string> = {},
) {
  const intake = runIntake(input);
  const researchPlan = createResearchPlan(input, intake.domain);
  const research = await executeResearchPlan(input, researchPlan, searchProvider, claimExtractor);
  const baseQuestions = generateQuestionnaire(input, intake.domain);
  const questions = enrichQuestionnaire(baseQuestions, research.ledger);
  const dna = compileProjectDNA(input, intake, questions, answers, research.ledger);
  const blueprint = createBlueprint(dna);
  return { intake, researchPlan, research, questions, dna, blueprint };
}
