import type { ProjectInput } from "../core/types";
import type { ResearchTask } from "./planner";
import type { SourceCandidate } from "./ranking";

export interface ResearchSearchProvider {
  name: string;
  search(task: ResearchTask, input: ProjectInput): Promise<SourceCandidate[]>;
}

export interface DraftResearchClaim {
  id: string;
  text: string;
  kind: "fact" | "inference";
  sourceUrls: string[];
  tags?: string[];
}

export interface ResearchClaimExtractor {
  name: string;
  extract(task: ResearchTask, input: ProjectInput, sources: SourceCandidate[]): Promise<DraftResearchClaim[]>;
}
