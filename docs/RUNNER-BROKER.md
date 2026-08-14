# SMART OS Runner Broker

## Purpose

SMART OS must not stop project execution merely because one execution provider is unavailable. The Runner Broker separates project health from runner infrastructure and selects only runners that advertise the capabilities required by the current execution lane.

## Decision flow

1. Classify the failure.
2. Code/runtime defects route to the normal specialist Fix Loop.
3. Billing, quota, unavailable runner, credentials, toolchain, network, or superseded-run conditions are infrastructure blockers.
4. For an infrastructure blocker, evaluate alternate runner advertisements.
5. Select the highest-scoring eligible runner and retain additional eligible runners as fallbacks.
6. If no eligible runner exists, keep the project technically blocked without modifying project code.

## Supported runner identities

The broker can represent GitHub Actions, a local shell host, Codex, Claude Code, Antigravity, or a future/custom runner. These are adapter identities only: a runner is never assumed to have a toolchain until it advertises the relevant host, lane, and tools.

## Native constraints

- Android execution must advertise the Android lane and the required Android/Gradle/ADB tools for the requested step.
- iOS execution requires a macOS host and the requested Xcode/simctl tools.
- A Linux or generic cloud agent cannot be selected for iOS merely because its label says iOS.

## Portable execution handoff

`PortableExecutionHandoff` transports the same `ExecutionPlan` to an alternate runner. The default handoff:

- is workspace-only;
- never resolves secrets;
- never authorizes public publication;
- requires explicit execution by the selected adapter;
- rejects commands outside the project workspace;
- rejects commands that require secrets.

This allows the same build/test intent to move between eligible runners without changing Project DNA, the Build Manifest, or release policy.

## Example fallback behavior

If GitHub Actions is classified as blocked by billing, a web task may route to an eligible local Codex/Claude Code host or another advertised web runner. An Android task may route only to a runner that actually advertises the requested Android tools. An iOS task remains blocked until an eligible macOS/Xcode runner is available.

## Release behavior

Runner rerouting does not weaken release gates. Evidence produced by an alternate runner still has to be ingested into the Artifact Registry and pass Release Readiness. Production distribution remains behind explicit human approval.
