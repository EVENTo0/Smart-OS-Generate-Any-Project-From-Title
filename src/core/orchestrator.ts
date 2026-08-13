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

export function generateProjectFoundation(input: ProjectInput, answers: Record<string, string> = {}) {
  const intake = runIntake(input);
  const questions = generateQuestionnaire(input, intake.domain);
  const dna = compileProjectDNA(input, intake, questions, answers);
  const blueprint = createBlueprint(dna);
  return { intake, questions, dna, blueprint };
}

function implementationFromFoundation(foundation: ReturnType<typeof generateProjectFoundation>) {
  const capability = selectCapability({ requiredTags: ["coding"], requireWorkspaceWrite: true });
  const buildManifest = createBuildManifest(foundation.dna.projectId, foundation.dna.platforms, capability.id);
  const implementation = generateImplementation({
    projectId: foundation.dna.projectId,
    title: foundation.dna.title,
    domain: foundation.dna.domain,
    targetPlatforms: foundation.dna.platforms,
    requirements: [...foundation.dna.hardRequirements, ...foundation.dna.constraints],
  });
  return { capability, buildManifest, implementation };
}

export function generateProjectImplementation(input: ProjectInput, answers: Record<string, string> = {}) {
  const foundation = generateProjectFoundation(input, answers);
  const implementationStage = implementationFromFoundation(foundation);
  return { ...foundation, ...implementationStage };
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
  const capability = selectCapability({ requiredTags: ["coding"], requireWorkspaceWrite: true });
  const buildManifest = createBuildManifest(foundation.dna.projectId, foundation.dna.platforms, capability.id);
  const implementation = generateImplementation({
    projectId: foundation.dna.projectId,
    title: foundation.dna.title,
    domain: foundation.dna.domain,
    targetPlatforms: foundation.dna.platforms,
    requirements: [...foundation.dna.hardRequirements, ...foundation.dna.constraints],
  });
  return { ...foundation, capability, buildManifest, implementation };
}
