import type { ProjectInput } from "./types";

export interface IntakeResult {
  title: string;
  domain: string;
  platforms: string[];
  constraints: string[];
}

export function normalizeTitle(title: string): string {
  const value = title.trim();
  if (!value) throw new Error("Project title is required");
  return value;
}

export function classifyDomain(input: ProjectInput): string {
  const value = `${input.title} ${input.description ?? ""}`.toLowerCase();
  if (/game|لعبة|vr|mmorpg|rpg/.test(value)) return "game";
  if (/app|تطبيق|mobile|ios|android/.test(value)) return "application";
  if (/site|website|موقع|web/.test(value)) return "website";
  if (/saas|platform|منصة/.test(value)) return "saas-platform";
  if (/api|backend/.test(value)) return "api-service";
  return "general-software";
}

export function runIntake(input: ProjectInput): IntakeResult {
  return {
    title: normalizeTitle(input.title),
    domain: classifyDomain(input),
    platforms: input.targetPlatforms ?? [],
    constraints: input.constraints ?? [],
  };
}
