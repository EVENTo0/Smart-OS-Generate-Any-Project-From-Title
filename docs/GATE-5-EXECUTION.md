# Gate 5 — Workspace Scaffold & Build/Test Execution Adapters

SMART OS turns a Build Manifest into a platform-aware, isolated execution plan. Commands are declarative by default. External execution requires an explicit executor and target.

## Workspace rule
All generated files, build plans, logs, test results, artifacts and fix-loop records must resolve under `workspaces/<project-id>/build/`.

## Platform lanes
- Web/PWA: Node package manager, framework build, browser smoke/e2e, optional preview deployment.
- Android: Gradle, Android SDK, Emulator/ADB; optional Device Streaming/Firebase Test Lab metadata.
- iOS: xcodebuild, Simulator; optional beta distribution metadata. Signing secrets are never stored in SMART OS state.
- Desktop: framework-specific build/test/package plan.
- Game/XR: engine/toolchain-specific build, headless/smoke/performance test plan when supported.

## Execution safety
- No shell execution is performed merely by generating a plan.
- Executors receive only workspace-relative working directories and an allowlisted command descriptor.
- Secrets are references only; never persisted in manifests or logs.
- A failed step emits a typed failure result and a recommended capability for the fix loop.

## Verification
- Gate 5 execution planner CI: GitHub Actions MVP run #26 — success.
- Gate 6 release-readiness core CI: GitHub Actions MVP run #27 — success.

## Next
Gate 7 adds fix-loop orchestration, artifact registry and release-candidate packaging while preserving explicit approval for public/store publishing.
