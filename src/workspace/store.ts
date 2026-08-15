import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import type { ProjectWorkspaceSnapshot } from "./types";

const WORKSPACE_ID = /^[a-z0-9](?:[a-z0-9-]{0,79})$/;

export function assertWorkspaceId(projectId: string): void {
  if (!WORKSPACE_ID.test(projectId)) throw new Error(`Unsafe workspace id: ${projectId}`);
}

export function resolveWorkspaceDirectory(root: string, projectId: string): string {
  assertWorkspaceId(projectId);
  const rootPath = resolve(root);
  const projectPath = resolve(rootPath, projectId);
  const prefix = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  if (!projectPath.startsWith(prefix)) throw new Error("Workspace escaped configured root");
  return projectPath;
}

export async function persistWorkspace(root: string, snapshot: ProjectWorkspaceSnapshot): Promise<string> {
  const projectPath = resolveWorkspaceDirectory(root, snapshot.projectId);
  await mkdir(projectPath, { recursive: true });
  const statePath = join(projectPath, "state.json");
  await writeFile(statePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return statePath;
}

export async function loadWorkspace(root: string, projectId: string): Promise<ProjectWorkspaceSnapshot> {
  const statePath = join(resolveWorkspaceDirectory(root, projectId), "state.json");
  return JSON.parse(await readFile(statePath, "utf8")) as ProjectWorkspaceSnapshot;
}
