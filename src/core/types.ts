export type ProviderName = "openai" | "anthropic" | "kimi";

export interface ProjectInput {
  title: string;
  description?: string;
  mode?: "existing-reference" | "new-idea" | "hybrid";
  preferredProvider?: "auto" | ProviderName;
  targetPlatforms?: string[];
  constraints?: string[];
}

export interface EvidenceRecord {
  id: string;
  claim: string;
  source: string;
  confidence: "high" | "medium" | "low";
}

export interface ProjectState {
  projectId: string;
  stage: string;
  input: ProjectInput;
  evidence: EvidenceRecord[];
}
