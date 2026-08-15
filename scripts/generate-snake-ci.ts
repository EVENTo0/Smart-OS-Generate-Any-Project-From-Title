import { generateProjectImplementation, materializeProjectImplementation } from "../src/core/orchestrator";

const result = generateProjectImplementation({
  title: "Snake game",
  targetPlatforms: ["web"],
  constraints: ["original identity", "phone-first"],
});

await materializeProjectImplementation(".ci-workspaces", result.implementation);
console.log(result.dna.projectId);
