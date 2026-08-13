import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateImplementation } from "../src/implementation/generator";
import { writeImplementation } from "../src/implementation/writer";

test("Snake implementation generator creates isolated playable build files", async () => {
  const bundle = generateImplementation({
    projectId: "snake-game",
    title: "Snake game",
    domain: "game",
    targetPlatforms: ["web", "android", "ios"],
    requirements: ["original visual identity", "mobile-first"],
  });
  assert.equal(bundle.requiresExternalExecution, false);
  assert.equal(bundle.templateId, "snake-web-v1");
  const main = bundle.files.find((file) => file.path === "src/main.js");
  assert.ok(main?.content.includes("Game Over"));
  assert.ok(main?.content.includes("pointerdown"));
  assert.ok(main?.content.includes("Score:"));
  const root = await mkdtemp(join(tmpdir(), "smart-os-"));
  const written = await writeImplementation(root, bundle);
  assert.ok(written.every((path) => path.includes("snake-game")));
  const project = JSON.parse(await readFile(join(root, "snake-game", "build", "project.json"), "utf8"));
  assert.equal(project.projectId, "snake-game");
});
