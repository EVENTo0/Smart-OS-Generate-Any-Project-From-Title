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

    candidates.forEach((candidate, index) => {
      const id = `${task.id}-source-${index + 1}`;
      sourceIdsByUrl.set(candidate.url, id);
      const source: SourceRecord = {
        id,
        url: candidate.url,
        title: candidate.title,
        publisher: candidate.publisher,
        tier: rankSource(candidate),
      };
      ledger = addSource(ledger, source);
    });

    const claims = await claimExtractor.extract(task, input, candidates);
    for (const draft of claims) {
      const sourceIds = draft.sourceUrls.map((url) => sourceIdsByUrl.get(url)).filter(Boolean) as string[];
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
