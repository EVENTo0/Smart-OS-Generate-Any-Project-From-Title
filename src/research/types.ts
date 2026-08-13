export type SourceTier = 1 | 2 | 3 | 4 | 5 | 6;
export type Confidence = "high" | "medium" | "low";
export type ClaimKind = "fact" | "inference" | "user-decision" | "ai-default";

export interface SourceRecord {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  tier: SourceTier;
  retrievedAt?: string;
  notes?: string;
}

export interface EvidenceClaim {
  id: string;
  text: string;
  kind: ClaimKind;
  confidence: Confidence;
  sourceIds: string[];
  tags?: string[];
}

export interface EvidenceLedger {
  sources: SourceRecord[];
  claims: EvidenceClaim[];
}
