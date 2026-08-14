import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { ControlRunSnapshot } from "./run-snapshot";

export interface ControlSnapshotHistoryEntry {
  snapshotKey: string;
  projectId: string;
  title: string;
  lifecycleState: string;
  releaseScore: number;
  candidateStatus: ControlRunSnapshot["release"]["candidateStatus"];
  historyPath: string;
}

export interface ControlSnapshotWriteResult {
  latestPath: string;
  historyPath: string;
  indexPath: string;
}

function safeSegment(value: string, label: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`Unsafe ${label}`);
  }
  return value;
}

function assertInside(base: string, target: string): void {
  const normalizedBase = resolve(base);
  const normalizedTarget = resolve(target);
  if (normalizedTarget !== normalizedBase && !normalizedTarget.startsWith(`${normalizedBase}${sep}`)) {
    throw new Error("Control snapshot path escaped control-app root");
  }
}

async function readHistoryIndex(indexPath: string): Promise<ControlSnapshotHistoryEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(indexPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
}

export async function writeControlSnapshot(input: {
  repositoryRoot: string;
  snapshot: ControlRunSnapshot;
  snapshotKey: string;
  maxHistoryEntries?: number;
}): Promise<ControlSnapshotWriteResult> {
  const projectId = safeSegment(input.snapshot.projectId, "project id");
  const snapshotKey = safeSegment(input.snapshotKey, "snapshot key");
  const maxHistoryEntries = input.maxHistoryEntries ?? 50;
  if (!Number.isInteger(maxHistoryEntries) || maxHistoryEntries < 1 || maxHistoryEntries > 500) {
    throw new Error("Invalid control snapshot history limit");
  }

  const controlRoot = resolve(input.repositoryRoot, "control-app");
  const latestPath = join(controlRoot, "run-snapshot.json");
  const historyPath = join(controlRoot, "history", projectId, `${snapshotKey}.json`);
  const indexPath = join(controlRoot, "history", "index.json");
  for (const target of [latestPath, historyPath, indexPath]) assertInside(controlRoot, target);

  await mkdir(dirname(historyPath), { recursive: true });
  await mkdir(dirname(indexPath), { recursive: true });

  const serialized = `${JSON.stringify(input.snapshot, null, 2)}\n`;
  await writeFile(latestPath, serialized, "utf8");
  await writeFile(historyPath, serialized, "utf8");

  const history = await readHistoryIndex(indexPath);
  const entry: ControlSnapshotHistoryEntry = {
    snapshotKey,
    projectId,
    title: input.snapshot.title,
    lifecycleState: input.snapshot.lifecycleState,
    releaseScore: input.snapshot.release.score,
    candidateStatus: input.snapshot.release.candidateStatus,
    historyPath: `history/${projectId}/${snapshotKey}.json`,
  };
  const next = [entry, ...history.filter((item) => !(item.projectId === projectId && item.snapshotKey === snapshotKey))]
    .slice(0, maxHistoryEntries);
  await writeFile(indexPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  return { latestPath, historyPath, indexPath };
}
