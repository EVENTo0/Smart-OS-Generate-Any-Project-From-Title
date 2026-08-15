import type { RunnerCapabilityAdvertisement } from "./runner-capability";
import type { CommandDescriptor, ExecutionPlan } from "./types";

export interface PortableExecutionHandoff {
  schemaVersion: "1";
  projectId: string;
  runnerId: string;
  runnerKind: string;
  workspaceRoot: string;
  commands: CommandDescriptor[];
  policy: {
    workspaceOnly: true;
    resolveSecrets: false;
    allowPublicPublish: false;
    requiresExplicitExecution: true;
  };
}

function isInsideWorkspace(path: string, workspaceRoot: string): boolean {
  return path === workspaceRoot || path.startsWith(`${workspaceRoot}/`);
}

export function createPortableExecutionHandoff(
  plan: ExecutionPlan,
  runner: RunnerCapabilityAdvertisement,
): PortableExecutionHandoff {
  if (!runner.workspaceOnly) throw new Error("Runner must be workspace-only");
  if (runner.allowsSecrets) throw new Error("Portable handoff cannot resolve secrets");
  if (runner.allowsPublicPublish) throw new Error("Portable handoff cannot publish publicly");
  if (!plan.workspaceRoot.startsWith(`workspaces/${plan.projectId}`)) {
    throw new Error("Execution plan workspace is outside the project workspace");
  }

  for (const command of plan.commands) {
    if (!isInsideWorkspace(command.workingDirectory, plan.workspaceRoot)) {
      throw new Error(`Command ${command.id} is outside the execution workspace`);
    }
    if (command.requiresSecrets?.length) {
      throw new Error(`Command ${command.id} requires secrets and cannot be delegated by default`);
    }
  }

  return {
    schemaVersion: "1",
    projectId: plan.projectId,
    runnerId: runner.runnerId,
    runnerKind: runner.runnerKind ?? "custom",
    workspaceRoot: plan.workspaceRoot,
    commands: plan.commands.map((command) => ({ ...command, args: [...command.args] })),
    policy: {
      workspaceOnly: true,
      resolveSecrets: false,
      allowPublicPublish: false,
      requiresExplicitExecution: true,
    },
  };
}
