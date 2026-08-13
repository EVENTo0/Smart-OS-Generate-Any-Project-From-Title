import test from "node:test";
import assert from "node:assert/strict";
import { generateEvidenceBackedFoundation } from "../src/core/orchestrator";
import { addClaim, createEvidenceLedger } from "../src/research/ledger";
import type { ResearchClaimExtractor, ResearchSearchProvider } from "../src/research/adapters";

const searchProvider: ResearchSearchProvider = {
  name: "fixture-search",
  async search(task) {
    if (task.id === "technology") {
      return [
        { url: "https://example.gov/snake", title: "Official platform record", declaredTier: 2 },
        { url: "https://docs.example.com/snake", title: "Technical documentation", declaredTier: 3 },
      ];
    }
    if (task.id === "comparables") {
      return [{ url: "https://community.example/snake", title: "Community observation", declaredTier: 6 }];
    }
    return [];
  },
};

const extractor: ResearchClaimExtractor = {
  name: "fixture-extractor",
  async extract(task, _input, sources) {
    if (task.id === "technology") {
      return [{
        id: "platform-evidence",
        text: "The researched target supports an iOS implementation path.",
        kind: "fact",
        sourceUrls: sources.map((source) => source.url),
        tags: ["question:primary-platform"],
      }];
    }
    if (task.id === "comparables") {
      return [{
        id: "weak-comparable",
        text: "A community source suggests a particular visual convention.",
        kind: "inference",
        sourceUrls: sources.map((source) => source.url),
        tags: ["comparable"],
      }];
    }
    return [];
  },
};

test("Gate 2 keeps evidence provenance and blocks weak claims from hard requirements", async () => {
  const result = await generateEvidenceBackedFoundation(
    { title: "Snake game", targetPlatforms: ["iOS", "Android"] },
    searchProvider,
    extractor,
  );

  const strong = result.research.ledger.claims.find((claim) => claim.id === "platform-evidence");
  const weak = result.research.ledger.claims.find((claim) => claim.id === "weak-comparable");
  assert.equal(strong?.confidence, "high");
  assert.equal(weak?.confidence, "low");
  assert.ok(strong?.sourceIds.length === 2);
  assert.ok(result.dna.hardRequirements.includes(strong!.text));
  assert.ok(!result.dna.hardRequirements.includes(weak!.text));
  assert.ok(result.questions.find((question) => question.id === "primary-platform")?.evidenceClaimIds.includes("platform-evidence"));
});

test("research-derived claims without sources are rejected", () => {
  const ledger = createEvidenceLedger();
  assert.throws(() => addClaim(ledger, {
    id: "unsupported",
    text: "Unsupported fact",
    kind: "fact",
    sourceIds: [],
  }));
});
