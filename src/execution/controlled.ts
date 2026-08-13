import type { CommandDescriptor, ExecutionResult } from "./types";

export type RunnerMode = "ci" | "local";

export interface ControlledExecutionPolicy {
  mode: RunnerMode;
  timeoutMs: number;
  maxOutputBytes: number;
  environmentAllowlist: string[];
  secretReferencesAllowed: boolean;
}

export const DEFAULT_CI_POLICY: ControlledExecutionPolicy = {
  mode: "ci",
  timeoutMs: 30_000,
  maxOutputBytes: 65_536,
  environmentAllowlist: ["CI", "NODE_ENV"],
  secretReferencesAllowed: false,
};

export interface RunnerOutcome {
  exitCode: number;
  summary?: string;
  logRefs?: string[];
  artifactRefs?: string[];
}

export interface SafeCommandRunner {
  run(descriptor: CommandDescriptor, policy?: ControlledExecutionPolicy): Promise<RunnerOutcome>;
}

export function validateExecutionPolicy(policy: ControlledExecutionPolicy): void {
  if (!Number.isInteger(policy.timeoutMs) || policy.timeoutMs < 100 || policy.timeoutMs > 600_000) throw new Error("Invalid executor timeout");
  if (!Number.isInteger(policy.maxOutputBytes) || policy.maxOutputBytes < 1024 || policy.maxOutputBytes > 10_000_000) throw new Error("Invalid output limit");
  if (policy.secretReferencesAllowed) throw new Error("Default controlled execution policy does not resolve secrets");
}

export function validateControlledCommand(projectId: string, descriptor: CommandDescriptor): void {
  const expected = `workspaces/${projectId}/build`;
  if (descriptor.workingDirectory !== expected) {
    throw new Error("Command working directory is outside the project build workspace");
  }
  if (descriptor.lane !== "web" || descriptor.executable !== "node") {
    throw new Error("Default policy currently allows only the web Node lane");
  }
  if (descriptor.args.length !== 2 || descriptor.args[0] !== "--check" || descriptor.args[1] !== "src/main.js") {
    throw new Error("Command arguments are not allowlisted");
  }
  if (descriptor.requiresSecrets?.length) {
    throw new Error("Default policy does not resolve secrets");
  }
}

export async function executeWithRunner(
  projectId: string,
  descriptor: CommandDescriptor,
  runner: SafeCommandRunner,
  policy: ControlledExecutionPolicy = DEFAULT_CI_POLICY,
): Promise<ExecutionResult> {
  validateExecutionPolicy(policy);
  validateControlledCommand(projectId, descriptor);
  const outcome = await runner.run(descriptor, policy);
  const passed = outcome.exitCode === 0;
  return {
    commandId: descriptor.id,
    status: passed ? "passed" : "failed",
    exitCode: outcome.exitCode,
    logRefs: outcome.logRefs ?? [],
    artifactRefs: outcome.artifactRefs ?? [],
    fixCapabilityId: passed ? undefined : "web-engineering-agent",
    summary: outcome.summary,
  };
}
