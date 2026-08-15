import type { ProjectInput } from "../../core/types";
import type { DraftResearchClaim, ResearchClaimExtractor, ResearchSearchProvider } from "../adapters";
import type { ResearchTask } from "../planner";
import type { SourceCandidate } from "../ranking";

export interface OpenAIResponsesClientLike {
  responses: {
    create(request: Record<string, unknown>): Promise<any>;
  };
}

function collectCitations(body: any): SourceCandidate[] {
  const byUrl = new Map<string, SourceCandidate>();
  for (const item of body?.output ?? []) {
    for (const source of item?.action?.sources ?? []) {
      if (typeof source?.url === "string") byUrl.set(source.url, { url: source.url, title: source.url });
    }
    for (const part of item?.content ?? []) {
      for (const annotation of part?.annotations ?? []) {
        if (annotation?.type === "url_citation" && typeof annotation.url === "string") {
          byUrl.set(annotation.url, { url: annotation.url, title: annotation.title ?? annotation.url });
        }
      }
    }
  }
  return [...byUrl.values()];
}

function collectText(body: any): string {
  return (body?.output ?? []).flatMap((item: any) => item?.content ?? [])
    .filter((part: any) => part?.type === "output_text" && typeof part.text === "string")
    .map((part: any) => part.text)
    .join("\n")
    .trim();
}

export class OpenAIWebResearchAdapter implements ResearchSearchProvider, ResearchClaimExtractor {
  readonly name = "openai-web-research";

  constructor(private readonly client: OpenAIResponsesClientLike, private readonly model: string) {}

  async search(task: ResearchTask, input: ProjectInput): Promise<SourceCandidate[]> {
    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      tools: [{ type: "web_search", search_context_size: "medium" }],
      input: `Research ${input.title}. Query: ${task.query}. Purpose: ${task.purpose}. Prefer primary and official sources.`,
    });
    return collectCitations(response);
  }

  async extract(task: ResearchTask, input: ProjectInput, sources: SourceCandidate[]): Promise<DraftResearchClaim[]> {
    const domains = [...new Set(sources.map((source) => {
      try { return new URL(source.url).hostname; } catch { return ""; }
    }).filter(Boolean))];
    const webSearch: Record<string, unknown> = { type: "web_search", search_context_size: "medium" };
    if (domains.length) webSearch.filters = { allowed_domains: domains.slice(0, 20) };

    const response = await this.client.responses.create({
      model: this.model,
      store: false,
      tools: [webSearch],
      input: `Research ${input.title} for: ${task.purpose}. Return JSON only with {"claims":[{"id":"...","text":"...","kind":"fact|inference","sourceUrls":["https://..."],"tags":["..."]}]}. Every claim must use URLs actually cited by the web search. Omit unsupported claims.`,
    });
    const cited = new Set(collectCitations(response).map((source) => source.url));
    const raw = collectText(response).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(raw);
    const claims = Array.isArray(parsed?.claims) ? parsed.claims : [];

    return claims.flatMap((claim: any, index: number) => {
      if (typeof claim?.text !== "string") return [];
      const sourceUrls = Array.isArray(claim.sourceUrls)
        ? claim.sourceUrls.filter((url: unknown) => typeof url === "string" && cited.has(url as string))
        : [];
      return [{
        id: typeof claim.id === "string" ? claim.id : `${task.id}-claim-${index + 1}`,
        text: claim.text,
        kind: claim.kind === "inference" ? "inference" : "fact",
        sourceUrls,
        tags: Array.isArray(claim.tags) ? claim.tags.filter((tag: unknown) => typeof tag === "string") : [],
      }];
    });
  }
}
