import type { CommandDescriptor, ExecutionResult } from "./types";

export interface RunnerOutcome {
  exitCode: number;
  summary?: string;
  logRefs?: string[];
  artifactRefs?: string[];
}

export interface SafeCommandRunner {
  run(descriptor: CommandDescriptor): Promise<RunnerOutcome>;
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
): Promise<ExecutionResult> {
  validateControlledCommand(projectId, descriptor);
  const outcome = await runner.run(descriptor);
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
