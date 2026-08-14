import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeControlSnapshot } from "../src/control/snapshot-store";
import type { ControlRunSnapshot } from "../src/control/run-snapshot";

const snapshot: ControlRunSnapshot = {
  schemaVersion: "1",
  projectId: "snake-game",
  title: "Snake game",
  lifecycleState: "RELEASE_CANDIDATE",
  targetLanes: ["web"],
  execution: {
    status: "succeeded",
    successfulRunnerId: "local-codex",
    maxAttempts: 2,
    attempts: [
      { attempt: 1, runnerId: "primary-ci", outcome: "infrastructure-failure", blockerKind: "billing" },
      { attempt: 2, runnerId: "local-codex", outcome: "passed" },
    ],
  },
  release: {
    score: 100,
    technicalReady: true,
    candidateStatus: "blocked",
    humanApprovalRequired: true,
    approvedByHuman: false,
    blockers: ["explicit human approval required"],
  },
  artifacts: [{ id: "build", kind: "build", producedBy: "local-codex", checksum: "sha256:build" }],
  infrastructure: { activeBlockers: [], historicalBlockers: ["billing"] },
  policy: { exposesSecrets: false, exposesRawLogs: false, allowsPublicPublish: false },
};

test("control snapshot store writes latest snapshot and read-only history index", async () => {
  const root = await mkdtemp(join(tmpdir(), "smart-os-control-"));
  const result = await writeControlSnapshot({ repositoryRoot: root, snapshot, snapshotKey: "run-001" });
  const latest = JSON.parse(await readFile(result.latestPath, "utf8"));
  const history = JSON.parse(await readFile(result.historyPath, "utf8"));
  const index = JSON.parse(await readFile(result.indexPath, "utf8"));

  assert.equal(latest.projectId, "snake-game");
  assert.equal(history.release.score, 100);
  assert.equal(index[0].historyPath, "history/snake-game/run-001.json");
  assert.equal(JSON.stringify(latest).includes("raw-log"), false);
});

test("control snapshot store rejects traversal-like snapshot keys", async () => {
  const root = await mkdtemp(join(tmpdir(), "smart-os-control-"));
  await assert.rejects(
    writeControlSnapshot({ repositoryRoot: root, snapshot, snapshotKey: "../escape" }),
    /Unsafe snapshot key/,
  );
});
