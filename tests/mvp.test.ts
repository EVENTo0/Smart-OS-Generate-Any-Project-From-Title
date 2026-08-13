import test from "node:test";
import assert from "node:assert/strict";
import { generateProjectFoundation } from "../src/core/orchestrator";

test("Snake game becomes a game project foundation", () => {
  const result = generateProjectFoundation({
    title: "Snake game",
    targetPlatforms: ["iOS", "Android"],
    constraints: ["original identity", "phone-first"],
  });

  assert.equal(result.intake.domain, "game");
  assert.deepEqual(result.dna.platforms, ["iOS", "Android"]);
  assert.equal(result.dna.status, "provisional");
  assert.ok(result.questions.length >= 3);
  assert.ok(result.blueprint.phases.includes("MVP"));
});
