import { adaptersForPlatforms } from "./adapters";
import type { ExecutionPlan, ExecutionResult } from "./types";

export function safeWorkspaceRoot(projectId: string): string {
  const safe = projectId.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!safe || safe.includes("..") || safe.includes("/") || safe.includes("\\")) throw new Error("Invalid projectId");
  return `workspaces/${safe}`;
}

export function createExecutionPlan(projectId: string, platforms: string[]): ExecutionPlan {
  const workspaceRoot = safeWorkspaceRoot(projectId);
  const commands = adaptersForPlatforms(platforms).flatMap((adapter) => adapter.plan(projectId, workspaceRoot));
  return { projectId, workspaceRoot, commands, executeByDefault: false };
}

export function routeFailure(result: ExecutionResult): string {
  if (result.status !== "failed") return "none";
  if (result.commandId.startsWith("android")) return "android-build-engineer";
  if (result.commandId.startsWith("ios")) return "ios-release-engineer";
  if (result.commandId.startsWith("game")) return "game-engineering-agent";
  if (result.commandId.startsWith("web")) return "web-engineering-agent";
  return "general-build-engineer";
}
