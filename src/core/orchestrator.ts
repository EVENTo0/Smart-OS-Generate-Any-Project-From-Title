import type { ProjectInput } from "./types";
import { runIntake } from "./intake";
import { generateQuestionnaire } from "./questionnaire";
import { compileProjectDNA } from "./dna";
import { createBlueprint } from "./blueprint";
import { createResearchPlan } from "../research/planner";
import { executeResearchPlan } from "../research/engine";
import { enrichQuestionnaire } from "../research/enrichment";
import type { ResearchClaimExtractor, ResearchSearchProvider } from "../research/adapters";
import { selectCapability } from "../capabilities/router";
import { createBuildManifest } from "../capabilities/build-manifest";
import { generateImplementation } from "../implementation/generator";
import type { ImplementationBundle } from "../implementation/types";
import { writeImplementation } from "../implementation/writer";
import { createExecutionPlan } from "../execution/planner";
import { adaptersForPlatforms } from "../execution/adapters";
import { previewSurfaces } from "../release/readiness";

export function generateProjectFoundation(input: ProjectInput, answers: Record<string, string> = {}) {
  const intake = runIntake(input);
  const questions = generateQuestionnaire(input, intake.domain);
  const dna = compileProjectDNA(input, intake, questions, answers);
  const blueprint = createBlueprint(dna);
  return { intake, questions, dna, blueprint };
}

function implementationStage(projectId: string, title: string, domain: string, platforms: string[], requirements: string[]) {
  const capability = selectCapability({ requiredTags: ["coding"], requireWorkspaceWrite: true });
  const buildManifest = createBuildManifest(projectId, platforms, capability.id);
  const implementation = generateImplementation({ projectId, title, domain, targetPlatforms: platforms, requirements });
  const executionPlan = createExecutionPlan(projectId, platforms);
  const lanes = adaptersForPlatforms(platforms).map((adapter) => adapter.lane);
  const previews = previewSurfaces(lanes);
  return { capability, buildManifest, implementation, executionPlan, previews };
}

export function generateProjectImplementation(input: ProjectInput, answers: Record<string, string> = {}) {
  const foundation = generateProjectFoundation(input, answers);
  const stage = implementationStage(
    foundation.dna.projectId,
    foundation.dna.title,
    foundation.dna.domain,
    foundation.dna.platforms,
    [...foundation.dna.hardRequirements, ...foundation.dna.constraints],
  );
  return { ...foundation, ...stage };
}

export async function materializeProjectImplementation(workspacesRoot: string, bundle: ImplementationBundle) {
  return writeImplementation(workspacesRoot, bundle);
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

export async function generateEvidenceBackedImplementation(
  input: ProjectInput,
  searchProvider: ResearchSearchProvider,
  claimExtractor: ResearchClaimExtractor,
  answers: Record<string, string> = {},
) {
  const foundation = await generateEvidenceBackedFoundation(input, searchProvider, claimExtractor, answers);
  const stage = implementationStage(
    foundation.dna.projectId,
    foundation.dna.title,
    foundation.dna.domain,
    foundation.dna.platforms,
    [...foundation.dna.hardRequirements, ...foundation.dna.constraints],
  );
  return { ...foundation, ...stage };
}
