import test from "node:test";
import assert from "node:assert/strict";
import { OpenAIWebResearchAdapter } from "../src/research/providers/openai";

function fakeResponse(text: string, url: string) {
  return {
    output: [
      { type: "web_search_call", action: { sources: [{ type: "url", url }] } },
      { type: "message", content: [{ type: "output_text", text, annotations: [{ type: "url_citation", url, title: "Source" }] }] },
    ],
  };
}

test("OpenAI adapter converts cited web output into research sources and claims", async () => {
  const url = "https://docs.example.com/snake";
  const calls: Record<string, unknown>[] = [];
  const client = {
    responses: {
      async create(request: Record<string, unknown>) {
        calls.push(request);
        if (calls.length === 1) return fakeResponse("Research complete", url);
        return fakeResponse(JSON.stringify({ claims: [{ id: "c1", text: "Documented fact", kind: "fact", sourceUrls: [url], tags: ["question:primary-platform"] }] }), url);
      },
    },
  };
  const adapter = new OpenAIWebResearchAdapter(client, "test-model");
  const task = { id: "technology", query: "snake technology", purpose: "Find technology", priority: 1 as const, preferredSourceTiers: [1,2,3] as const };
  const sources = await adapter.search(task, { title: "Snake game" });
  const claims = await adapter.extract(task, { title: "Snake game" }, sources);

  assert.equal(sources[0]?.url, url);
  assert.equal(claims[0]?.sourceUrls[0], url);
  assert.equal((calls[0]?.store), false);
  assert.ok(Array.isArray(calls[0]?.tools));
});
