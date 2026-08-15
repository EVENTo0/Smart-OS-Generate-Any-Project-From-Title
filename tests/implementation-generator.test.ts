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

test("Universal product generator creates a live website plus app preview from a non-game request", () => {
  const bundle = generateImplementation({
    projectId: "nova-service-hub",
    title: "NOVA Service Hub",
    domain: "application",
    targetPlatforms: ["web", "android", "ios"],
    requirements: ["service catalog", "customer request flow", "mobile-first"],
  });

  assert.equal(bundle.templateId, "universal-product-web-mobile-v1");
  assert.equal(bundle.requiresExternalExecution, false);
  const paths = new Set(bundle.files.map((file) => file.path));
  assert.ok(paths.has("index.html"));
  assert.ok(paths.has("styles.css"));
  assert.ok(paths.has("app.js"));
  assert.ok(paths.has("manifest.webmanifest"));

  const html = bundle.files.find((file) => file.path === "index.html")?.content ?? "";
  const app = bundle.files.find((file) => file.path === "app.js")?.content ?? "";
  assert.ok(html.includes("NOVA Service Hub"));
  assert.ok(html.includes("Website"));
  assert.ok(html.includes("App"));
  assert.ok(html.includes("requestForm"));
  assert.ok(app.includes("setPreview"));
  assert.ok(app.includes("Demo request created"));
});
