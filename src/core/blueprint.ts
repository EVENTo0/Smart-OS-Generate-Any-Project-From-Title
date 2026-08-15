import type { ProjectDNA } from "./dna";

export interface ProjectBlueprint {
  projectId: string;
  phases: string[];
}

export function createBlueprint(dna: ProjectDNA): ProjectBlueprint {
  return {
    projectId: dna.projectId,
    phases: [
      "Research & Evidence",
      "Project DNA",
      "Architecture & Design",
      "Prototype",
      "MVP",
      "Verification",
      "Release",
    ],
  };
}
