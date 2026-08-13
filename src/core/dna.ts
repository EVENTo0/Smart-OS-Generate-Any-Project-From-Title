export interface ProjectDNA {
  projectId: string;
  title: string;
  domain: string;
  platforms: string[];
  goal: string;
  constraints: string[];
  decisions: Record<string, string>;
  status: "provisional" | "approved";
}

export function makeProjectId(title: string): string {
  const cleaned = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "project";
}
