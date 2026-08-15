# Gate 17 — Resilient Runner Broker & Portable Execution Fallback

## Status

Code-complete on isolated branch `infra-blocker-classifier`. Full GitHub Actions validation is externally blocked by the account billing/spending-limit state.

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
- provenance accepts either Git commit identity or a SHA-256 source-artifact digest

## Verified alternate-runner proof

A real generated Snake Web artifact was executed outside GitHub Actions in an isolated local runner. `node --check src/main.js` exited 0 and checksums were recorded in `examples/snake-game/local-runner-evidence.json`.

The committed evidence contract was then exercised locally through the actual release primitives:

`Runner Evidence → ArtifactRegistry → ReleaseReadiness → ReleaseCandidateManifest`

Observed result:

- evidence verified: `true`
- build artifact present: `true`
- test-report artifact present: `true`
- release-readiness score: `100`
- technical candidate readiness: `true`
- candidate without human approval: `blocked`
- only blocker without approval: `explicit human approval required`
- candidate with explicit human approval: `ready`

This local behavioral verification does not replace the full repository CI suite. It proves that the alternate-runner evidence contract and release gate integrate correctly while GitHub Actions is unavailable.

## Remaining validation

When GitHub Actions or another complete authorized repository runner is available:

1. run the full repository test suite;
2. repeat the alternate-runner proof through the normal repository test harness;
3. keep signing/TestFlight/Play/production behind explicit human approval.
