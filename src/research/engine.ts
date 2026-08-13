import type { ProjectInput } from "../core/types";
import { addClaim, addSource, createEvidenceLedger } from "./ledger";
import type { ResearchPlan } from "./planner";
import { rankCandidates, rankSource } from "./ranking";
import type { ResearchClaimExtractor, ResearchSearchProvider } from "./adapters";
import type { EvidenceLedger, SourceRecord } from "./types";

export interface ResearchRun {
  provider: string;
  extractor: string;
  ledger: EvidenceLedger;
}

export async function executeResearchPlan(
  input: ProjectInput,
  plan: ResearchPlan,
  searchProvider: ResearchSearchProvider,
  claimExtractor: ResearchClaimExtractor,
): Promise<ResearchRun> {
  let ledger = createEvidenceLedger();

  for (const task of plan.tasks) {
    const candidates = rankCandidates(await searchProvider.search(task, input));
    const sourceIdsByUrl = new Map<string, string>();
    let sourceCounter = 0;

    const ensureSource = (url: string, title?: string): string => {
      const existing = sourceIdsByUrl.get(url) ?? ledger.sources.find((source) => source.url === url)?.id;
      if (existing) {
        sourceIdsByUrl.set(url, existing);
        return existing;
      }
      sourceCounter += 1;
      const id = `${task.id}-source-${sourceCounter}`;
      const candidate = candidates.find((item) => item.url === url) ?? { url, title: title ?? url };
      const source: SourceRecord = {
        id,
        url,
        title: candidate.title ?? title ?? url,
        publisher: candidate.publisher,
        tier: rankSource(candidate),
      };
      ledger = addSource(ledger, source);
      sourceIdsByUrl.set(url, id);
      return id;
    };

    for (const candidate of candidates) ensureSource(candidate.url, candidate.title);

    const claims = await claimExtractor.extract(task, input, candidates);
    for (const draft of claims) {
      const sourceIds = draft.sourceUrls.map((url) => ensureSource(url));
      ledger = addClaim(ledger, {
        id: draft.id,
        text: draft.text,
        kind: draft.kind,
        sourceIds,
        tags: [...(draft.tags ?? []), `task:${task.id}`],
      });
    }
  }

  return { provider: searchProvider.name, extractor: claimExtractor.name, ledger };
}
