import test from "node:test";
import assert from "node:assert/strict";
import { classifyInfrastructureBlocker } from "../src/execution/infrastructure-blocker";

test("billing block is infrastructure, not a coding failure", () => {
  const blocker = classifyInfrastructureBlocker({
    message: "Job was not started because recent account payments have failed or the spending limit needs to be increased",
    jobStarted: false,
    runnerAllocated: false,
  });
  assert.equal(blocker?.kind, "billing");
  assert.equal(blocker?.routeToCodingAgent, false);
});
