import type { ProjectInput } from "./types";
import { runIntake } from "./intake";
import { generateQuestionnaire } from "./questionnaire";
import { compileProjectDNA } from "./dna";
import { createBlueprint } from "./blueprint";

export function generateProjectFoundation(input: ProjectInput, answers: Record<string, string> = {}) {
  const intake = runIntake(input);
  const questions = generateQuestionnaire(input, intake.domain);
  const dna = compileProjectDNA(input, intake, questions, answers);
  const blueprint = createBlueprint(dna);
  return { intake, questions, dna, blueprint };
}
