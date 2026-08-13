import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dossier = JSON.parse(readFileSync(new URL("../examples/snake-game/research-dossier.json", import.meta.url), "utf8"));

test("Snake dossier keeps source references valid", () => {
  const ids = new Set(dossier.sources.map((source: any) => source.id));
  assert.ok(dossier.sources.length >= 3);
  for (const claim of dossier.claims) {
    assert.ok(claim.sourceIds.length > 0);
    for (const id of claim.sourceIds) assert.ok(ids.has(id));
  }
  assert.ok(dossier.abstentions.length >= 1);
});
