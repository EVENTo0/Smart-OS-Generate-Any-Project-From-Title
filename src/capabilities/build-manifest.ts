export interface BuildTask {
  id: string;
  title: string;
  capabilityId: string;
  toolchain: string[];
  dependencies: string[];
  acceptance: string[];
  tests: string[];
  rollback: string[];
}

export interface BuildManifest {
  projectId: string;
  generatedAt: string;
  tasks: BuildTask[];
  targetPlatforms: string[];
  workspaceOnly: true;
}

export function createBuildManifest(projectId: string, targetPlatforms: string[], capabilityId: string): BuildManifest {
  const tasks: BuildTask[] = [
    {
      id: "scaffold",
      title: "Create isolated project scaffold",
      capabilityId,
      toolchain: [],
      dependencies: [],
      acceptance: ["workspace created", "no sibling repository writes"],
      tests: ["workspace isolation"],
      rollback: ["remove generated workspace files"],
    },
    {
      id: "prototype",
      title: "Build first executable prototype",
      capabilityId,
      toolchain: targetPlatforms,
      dependencies: ["scaffold"],
      acceptance: ["prototype runs on at least one target test surface"],
      tests: ["smoke test", "target platform test"],
      rollback: ["restore prior workspace snapshot"],
    },
  ];
  return { projectId, generatedAt: new Date().toISOString(), tasks, targetPlatforms, workspaceOnly: true };
}
