# SMART OS Capability Broker

Gate 4 routes project work to the best available model, agent, toolchain, and test surface without hard-wiring one vendor.

## AI providers and agent surfaces
- OpenAI / ChatGPT / Codex
- Anthropic Claude / Claude Code
- Moonshot Kimi
- Google Gemini API
- Google Antigravity Agent / CLI / SDK / IDE
- Meta Llama local or hosted runtime
- Qwen local or hosted runtime
- future provider adapters

## Local inference lane
SMART OS may route privacy-sensitive, offline, low-cost, or repeatable jobs to a local runtime. Supported adapter targets include a generic OpenAI-compatible local endpoint and provider-specific adapters. Candidate runtimes include llama.cpp, Ollama, LM Studio, native Qwen and native Llama tooling when compatible with the selected model/license/hardware.

Local selection must account for RAM/VRAM, quantization, model license, context length, tool-calling support, latency, quality, and device availability. Large models must never be assumed runnable on the user's phone or laptop without a hardware check.

## Build and test toolchains
Web/PWA: Node, browser automation, Vercel preview, Lighthouse/accessibility/performance gates.

iOS/iPadOS/visionOS: Xcode/xcodebuild lane, simulator/physical-device verification, signing readiness, App Store Connect/TestFlight beta lane. TestFlight is a distribution/testing gate, not a compiler.

Android: Android Studio, Android SDK/Build Tools, Gradle, Emulator/AVD, ADB physical-device lane, Android Device Streaming when available, Firebase Test Lab as an optional cloud device matrix, APK/AAB inspection and release validation.

Desktop: platform-native or cross-platform build/test adapters selected from Project DNA.

Game/3D/XR: engine-native build pipeline plus target-device smoke/performance testing; Unreal/Unity/Godot or other engines are selected only from evidence and project constraints.

## Routing score
Each candidate has: quality, cost, latency, availability, privacy, local-capable, tool-use, coding, multimodal, long-context, platform-fit, and reliability. The broker selects the lowest-risk candidate satisfying hard constraints rather than always selecting the most powerful model.

## Safety and isolation
Capabilities receive least-privilege tool scopes. Build/test tools may write only inside the active project workspace unless an explicit export target is approved. Credentials, signing keys, API keys, certificates, provisioning profiles, and store secrets are never committed to the repository.