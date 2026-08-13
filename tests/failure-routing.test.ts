import test from "node:test";
import assert from "node:assert/strict";
import { routeFailureForRemediation } from "../src/release/failure-routing";

test("code failure still routes to specialist remediation", () => {
  const decision = routeFailureForRemediation({
    id: "build-1",
    commandId: "web-build",
    summary: "SyntaxError in generated source",
    specialistCapabilityId: "web-engineering-agent",
    infrastructure: { jobStarted: true, runnerAllocated: true },
  });
  assert.equal(decision.kind, "code");
  if (decision.kind === "code") assert.equal(decision.failure.specialistCapabilityId, "web-engineering-agent");
});
