import test from "node:test";
import assert from "node:assert/strict";
import { selectCapability } from "../src/capabilities/router";
import { createBuildManifest } from "../src/capabilities/build-manifest";

test("local routing and manifest isolation", () => {
  const selected = selectCapability({ requiredTags: ["local", "privacy"], preferLocal: true });
  assert.equal(selected.local, true);
  const manifest = createBuildManifest("snake-game", ["iOS", "Android"], selected.id);
  assert.equal(manifest.workspaceOnly, true);
  assert.ok(manifest.tasks.length >= 2);
});