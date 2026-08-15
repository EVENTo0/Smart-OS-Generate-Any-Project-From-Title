import test from "node:test";
import assert from "node:assert/strict";
import { routeExecutionRunner } from "../src/execution/runner-broker";

test("billing-blocked CI falls back to local web runner", () => {
  const decision = routeExecutionRunner({ lane: "web", requiredTools: ["node"], preferLocal: true }, [
    {
      runnerId: "github-actions",
      runnerKind: "github-actions",
      hostPlatform: "linux",
      workspaceOnly: true,
      nativePlatforms: [],
      lanes: ["web"],
      availableTools: ["node"],
      allowsSecrets: false,
      allowsPublicPublish: false,
      availability: "blocked",
      local: false,
      blocker: { kind: "billing", summary: "spending limit reached", retryableWithoutCodeChange: true, routeToCodingAgent: false },
    },
    {
      runnerId: "local-codex",
      runnerKind: "codex",
      hostPlatform: "linux",
      workspaceOnly: true,
      nativePlatforms: [],
      lanes: ["web"],
      availableTools: ["node"],
      allowsSecrets: false,
      allowsPublicPublish: false,
      availability: "available",
      local: true,
    },
  ]);

  assert.equal(decision.selectedRunnerId, "local-codex");
  assert.equal(decision.infrastructureBlockers[0]?.kind, "billing");
});
