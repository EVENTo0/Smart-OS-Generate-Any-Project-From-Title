import test from "node:test";
import assert from "node:assert/strict";
import { decideResilientExecution } from "../src/execution/resilient-routing";

test("runner blocker selects an alternate eligible runner", () => {
  const decision = decideResilientExecution({
    failureId: "infra-1",
    commandId: "web-check",
    summary: "runner unavailable",
    specialistCapabilityId: "web-engineering-agent",
    runnerRequest: { lane: "web", requiredTools: ["node"], preferLocal: true },
    runners: [{
      runnerId: "local-runner",
      runnerKind: "local-shell",
      hostPlatform: "linux",
      workspaceOnly: true,
      nativePlatforms: [],
      lanes: ["web"],
      availableTools: ["node"],
      allowsSecrets: false,
      allowsPublicPublish: false,
      local: true,
    }],
  });

  assert.equal(decision.kind, "reroute");
});
