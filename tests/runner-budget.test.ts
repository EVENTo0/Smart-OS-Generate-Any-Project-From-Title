import test from "node:test";
import assert from "node:assert/strict";
import { routeExecutionRunner } from "../src/execution/runner-broker";
import type { RunnerCapabilityAdvertisement } from "../src/execution/runner-capability";

const runners: RunnerCapabilityAdvertisement[] = [
  {
    runnerId: "fast-expensive",
    runnerKind: "custom",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
    quality: 5,
    privacy: 4,
    cost: 3,
    latency: 5,
    estimatedCostUnits: 8,
    estimatedLatencyMs: 500,
  },
  {
    runnerId: "budget-local",
    runnerKind: "local-shell",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
    local: true,
    quality: 4,
    privacy: 5,
    cost: 5,
    latency: 4,
    estimatedCostUnits: 1,
    estimatedLatencyMs: 1500,
  },
];

test("runner broker excludes candidates above an explicit cost ceiling", () => {
  const route = routeExecutionRunner({
    lane: "web",
    requiredTools: ["node"],
    maxEstimatedCostUnits: 2,
    maxEstimatedLatencyMs: 2000,
  }, runners);

  assert.equal(route.selectedRunnerId, "budget-local");
  const expensive = route.evaluations.find((item) => item.runnerId === "fast-expensive");
  assert.equal(expensive?.eligible, false);
  assert.ok(expensive?.reasons.includes("runner exceeds cost budget"));
});

test("runner broker requires estimates when a strict budget is requested", () => {
  const unknown: RunnerCapabilityAdvertisement = {
    runnerId: "unknown-cost",
    runnerKind: "custom",
    hostPlatform: "linux",
    workspaceOnly: true,
    nativePlatforms: [],
    lanes: ["web"],
    availableTools: ["node"],
    allowsSecrets: false,
    allowsPublicPublish: false,
  };
  const route = routeExecutionRunner({ lane: "web", maxEstimatedCostUnits: 2 }, [unknown]);
  assert.equal(route.selectedRunnerId, undefined);
  assert.ok(route.evaluations[0]?.reasons.includes("runner cost estimate missing"));
});
