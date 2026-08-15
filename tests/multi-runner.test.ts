import test from "node:test";
import assert from "node:assert/strict";
import { createMultiRunnerExecution, currentRunnerId, recordRunnerAttempt } from "../src/execution/multi-runner";
import type { RunnerCapabilityAdvertisement } from "../src/execution/runner-capability";

const runners: RunnerCapabilityAdvertisement[] = [
  {
    runnerId: "primary-ci",
    runnerKind: "github-actions",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
    availability: "available",
    quality: 5,
    privacy: 5,
    cost: 5,
    latency: 5,
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
    quality: 4,
    privacy: 5,
    cost: 5,
    latency: 4,
  },
];

const billingBlocker = {
  kind: "billing" as const,
  summary: "provider spending limit reached",
  retryableWithoutCodeChange: true,
  routeToCodingAgent: false as const,
};

test("infrastructure failure advances to the next eligible runner", () => {
  let state = createMultiRunnerExecution({
    request: { lane: "web", requiredTools: ["node"] },
    runners,
    maxAttempts: 2,
  });
  assert.equal(currentRunnerId(state), "primary-ci");

  state = recordRunnerAttempt(state, "primary-ci", {
    kind: "infrastructure-failure",
    blocker: billingBlocker,
  });
  assert.equal(state.status, "running");
  assert.equal(currentRunnerId(state), "local-codex");

  state = recordRunnerAttempt(state, "local-codex", { kind: "passed" });
  assert.equal(state.status, "succeeded");
  assert.equal(state.successfulRunnerId, "local-codex");
  assert.equal(state.attempts.length, 2);
});

test("code failure stops fallback and routes to specialist repair", () => {
  let state = createMultiRunnerExecution({
    request: { lane: "web", requiredTools: ["node"] },
    runners,
  });
  state = recordRunnerAttempt(state, "primary-ci", {
    kind: "code-failure",
    summary: "SyntaxError in generated source",
    specialistCapabilityId: "web-engineering-agent",
  });
  assert.equal(state.status, "code-fix-required");
  assert.equal(currentRunnerId(state), undefined);
  assert.equal(state.codeFailure?.specialistCapabilityId, "web-engineering-agent");
});

test("fallback stops when max attempts are exhausted", () => {
  let state = createMultiRunnerExecution({
    request: { lane: "web", requiredTools: ["node"] },
    runners,
    maxAttempts: 1,
  });
  state = recordRunnerAttempt(state, "primary-ci", {
    kind: "infrastructure-failure",
    blocker: billingBlocker,
  });
  assert.equal(state.status, "infrastructure-blocked");
  assert.equal(state.attempts.length, 1);
});
