import type { ProjectInput } from "../core/types";
import type { SourceTier } from "./types";

export interface ResearchTask {
  id: string;
  query: string;
  purpose: string;
  priority: 1 | 2 | 3;
  preferredSourceTiers: SourceTier[];
}

export interface ResearchPlan {
  title: string;
  domain: string;
  tasks: ResearchTask[];
}

export function createResearchPlan(input: ProjectInput, domain: string): ResearchPlan {
  const title = input.title.trim();
  return {
    title,
    domain,
    tasks: [
      { id: "identity-history", query: `${title} official history developer publisher`, purpose: "Establish identity and documented history.", priority: 1, preferredSourceTiers: [1,2,3] },
      { id: "technology", query: `${title} official technology engine language platform`, purpose: "Discover documented technologies and platform constraints.", priority: 1, preferredSourceTiers: [1,2,3] },
      { id: "core-patterns", query: `${title} ${domain} mechanics workflow UX architecture`, purpose: "Extract general functional patterns without copying protected expression.", priority: 1, preferredSourceTiers: [1,2,3,4] },
      { id: "comparables", query: `${title} similar ${domain} comparable projects`, purpose: "Identify comparable systems and reusable general patterns.", priority: 2, preferredSourceTiers: [1,2,3,4] },
      { id: "platform-delivery", query: `${domain} platform requirements deployment distribution best practices`, purpose: "Find implementation and delivery constraints.", priority: 2, preferredSourceTiers: [1,2,3] },
    ],
  };
}
