import type { ProjectInput } from "./types";

export type Confidence = "high" | "medium" | "low";

export interface ProjectQuestion {
  id: string;
  prompt: string;
  options: string[];
  recommended: string;
  confidence: Confidence;
}

export function generateQuestionnaire(input: ProjectInput, domain: string): ProjectQuestion[] {
  const platformDefault = input.targetPlatforms?.[0] ?? (domain === "game" ? "Web" : "Web/PWA");
  return [
    {
      id: "primary-platform",
      prompt: "What is the primary target platform?",
      options: ["Web/PWA", "iOS", "Android", "PC", "VR/XR", "Multi-platform"],
      recommended: platformDefault,
      confidence: input.targetPlatforms?.length ? "high" : "medium",
    },
    {
      id: "delivery-scope",
      prompt: "What should the first delivery prove?",
      options: ["Prototype", "MVP", "Production-ready", "Research/specification only"],
      recommended: "MVP",
      confidence: "medium",
    },
    {
      id: "quality-priority",
      prompt: "Which quality dimension has highest priority?",
      options: ["Speed", "Visual quality", "Reliability", "Low cost", "Balanced"],
      recommended: "Balanced",
      confidence: "medium",
    },
  ];
}
