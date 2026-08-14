# Gate 17 — Resilient Runner Broker & Portable Execution Fallback

## Status

Code-complete on isolated branch `infra-blocker-classifier`. Full repository CI validation is externally blocked by the GitHub account billing/spending-limit state.

## Implemented

- infrastructure blocker classifier before Fix Loop routing
- deterministic runner capability broker with fallback chain
- workspace-only runner advertisements
- iOS host/toolchain restriction: macOS + Xcode/simctl
- portable execution handoff for Local/Codex/Claude Code/Antigravity/custom runners
- default no-secrets/no-publication policy
- resilient infrastructure rerouting
- unified runner evidence ingestion
- runner evidence → `ExecutionResult[]`
- runner artifacts → `ArtifactRecord[]`
- infrastructure blockers remain outside coding remediation
- Release Gate can remain blocked by infrastructure without classifying the project as a code regression

## Verification available now

Static branch comparison shows Gate 17 is isolated from `foundation-v0.1` and contains only the runner/failure/evidence additions plus focused tests/docs.

Focused tests exist for:
- GitHub billing → alternate runner fallback
- iOS host restriction
- portable workspace handoff
- infrastructure rerouting
- successful alternate-runner evidence ingestion
- blocked runner evidence without coding fix assignment
- RC blocked by infrastructure without a code regression

## Validation still required

When an authorized runner is available:
1. run the full repository test suite;
2. execute the Snake web build through an alternate runner;
3. ingest its evidence through `runner-evidence.ts`;
4. confirm Artifact Registry + Release Gate behavior;
5. keep signing/TestFlight/Play/production behind explicit human approval.

Do not open a new PR solely to run CI while the GitHub Actions account is blocked.
