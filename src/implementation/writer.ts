import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { ImplementationBundle } from "./types";
import { resolveWorkspaceDirectory } from "../workspace/store";

function safeTarget(root: string, relativePath: string): string {
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("..")) {
    throw new Error(`Unsafe generated path: ${relativePath}`);
  }
  const buildRoot = resolve(root);
  const target = resolve(buildRoot, relativePath);
  const prefix = buildRoot.endsWith(sep) ? buildRoot : `${buildRoot}${sep}`;
  if (!target.startsWith(prefix)) throw new Error("Generated file escaped build root");
  return target;
}

export async function writeImplementation(workspacesRoot: string, bundle: ImplementationBundle): Promise<string[]> {
  const workspace = resolveWorkspaceDirectory(workspacesRoot, bundle.projectId);
  const buildRoot = resolve(workspace, "build");
  await mkdir(buildRoot, { recursive: true });
  const written: string[] = [];
  for (const file of bundle.files) {
    const target = safeTarget(buildRoot, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
    written.push(target);
  }
  return written;
}
