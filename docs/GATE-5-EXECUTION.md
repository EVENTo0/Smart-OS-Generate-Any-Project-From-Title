# Gate 5 — Workspace Scaffold & Build/Test Execution Adapters

SMART OS turns a Build Manifest into a platform-aware, isolated execution plan. Commands are declarative by default. External execution requires an explicit executor and target.

## Workspace rule
All generated files, build plans, logs, test results, artifacts and fix-loop records must resolve under `workspaces/<project-id>/build/`.

## Platform lanes
- Web/PWA: Node package manager, framework build, browser smoke/e2e, optional preview deployment.
- Android: Gradle, Android SDK, Emulator/ADB; optional Device Streaming/Firebase Test Lab metadata.
- iOS: xcodebuild, Simulator; optional TestFlight delivery metadata. Signing secrets are never stored in SMART OS state.
- Desktop: framework-specific build/test/package plan.
- Game/XR: engine/toolchain-specific build, headless/smoke/performance test plan when supported.

## Execution safety
- No shell execution is performed merely by generating a plan.
- Executors receive only workspace-relative working directories and an allowlisted command descriptor.
- Secrets are references only; never persisted in manifests or logs.
- A failed step emits a typed failure result and a recommended capability for the fix loop.

## Exit criteria
1. deterministic platform-to-adapter mapping
2. scaffold plan remains inside workspace root
3. build/test result records are typed and auditable
4. failure routing returns a capability/agent suggestion
5. CI tests pass
