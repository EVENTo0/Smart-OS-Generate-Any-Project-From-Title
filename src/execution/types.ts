export type PlatformLane = "web" | "android" | "ios" | "desktop" | "game-xr";

export interface CommandDescriptor {
  id: string;
  lane: PlatformLane;
  executable: string;
  args: string[];
  workingDirectory: string;
  purpose: "build" | "test" | "package" | "preview";
  requiresSecrets?: string[];
}

export interface ExecutionPlan {
  projectId: string;
  workspaceRoot: string;
  commands: CommandDescriptor[];
  executeByDefault: false;
}

export interface ExecutionResult {
  commandId: string;
  status: "planned" | "passed" | "failed" | "skipped";
  exitCode?: number;
  logRefs: string[];
  artifactRefs: string[];
  fixCapabilityId?: string;
  summary?: string;
}
