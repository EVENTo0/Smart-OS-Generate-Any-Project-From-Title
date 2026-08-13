import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadWorkspace, persistWorkspace, resolveWorkspaceDirectory } from "../src/workspace/store";

test("workspace persistence stays inside configured root", async () => {
  const temp = await mkdtemp(join(tmpdir(), "smart-os-"));
  const root = join(temp, "workspaces");
  const snapshot: any = {
    schemaVersion: 1, projectId: "snake-game", savedAt: new Date(0).toISOString(),
    input: { title: "Snake game" }, researchPlan: { title: "Snake game", domain: "game", tasks: [] },
    evidence: { sources: [], claims: [] }, patterns: { comparables: [], patterns: [], edges: [] },
    questions: [], answers: {}, dna: { projectId: "snake-game", decisions: {} },
    blueprint: { projectId: "snake-game", phases: [] }, decisions: {},
    verification: { status: "pending", checks: [] },
  };
  try {
    const path = await persistWorkspace(root, snapshot);
    const loaded = await loadWorkspace(root, "snake-game");
    assert.equal(loaded.projectId, "snake-game");
    assert.ok(path.startsWith(resolveWorkspaceDirectory(root, "snake-game")));
    assert.throws(() => resolveWorkspaceDirectory(root, "../escape"), /Unsafe workspace id/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
