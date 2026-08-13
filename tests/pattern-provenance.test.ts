import test from "node:test";
import assert from "node:assert/strict";
import { addClaim, addSource, createEvidenceLedger } from "../src/research/ledger";
import { buildPatternGraph } from "../src/patterns/graph";

test("pattern approval requires evidence provenance", () => {
  let ledger = createEvidenceLedger();
  ledger = addSource(ledger, { id: "s1", url: "urn:source:1", title: "Reference", tier: 1 });
  ledger = addClaim(ledger, { id: "c1", text: "Documented general interaction pattern.", kind: "fact", sourceIds: ["s1"] });
  const graph = buildPatternGraph(
    ledger,
    [{ id: "r1", name: "Reference", summary: "Reference only.", evidenceClaimIds: ["c1"], referenceOnly: true, excludedMaterials: [] }],
    [{ id: "p1", category: "mechanic", label: "Movement", description: "Original movement pattern.", evidenceClaimIds: ["c1"], comparableSystemIds: ["r1"], requestApproval: true }],
  );
  assert.equal(graph.patterns[0].status, "approved");
  assert.deepEqual(graph.patterns[0].evidenceClaimIds, ["c1"]);
  assert.equal(graph.comparables[0].referenceOnly, true);
});
