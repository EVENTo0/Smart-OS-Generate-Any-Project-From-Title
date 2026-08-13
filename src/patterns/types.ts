export type PatternCategory = "mechanic" | "workflow" | "ux" | "architecture" | "technology" | "business-model" | "content-structure";

export type ExcludedMaterial = "repository-content" | "brand-identity" | "media-assets" | "protected-expression";

export interface ComparableSystem {
  id: string;
  name: string;
  summary: string;
  evidenceClaimIds: string[];
  referenceOnly: true;
  excludedMaterials: ExcludedMaterial[];
}

export interface PatternDraft {
  id: string;
  category: PatternCategory;
  label: string;
  description: string;
  evidenceClaimIds: string[];
  comparableSystemIds: string[];
  requestApproval?: boolean;
}

export interface PatternNode extends PatternDraft {
  status: "candidate" | "approved";
}

export interface PatternEdge {
  from: string;
  to: string;
  relation: "supports" | "related";
}

export interface PatternGraph {
  comparables: ComparableSystem[];
  patterns: PatternNode[];
  edges: PatternEdge[];
}
