import type { ExecutionResult, PlatformLane } from "../execution/types";

export interface PreviewSurface {
  lane: PlatformLane;
  target: string;
  kind: "local" | "emulator" | "simulator" | "device" | "preview-url" | "beta";
  requiresExplicitCredentials: boolean;
}

export interface ReleaseReadiness {
  score: number;
  readyForCandidate: boolean;
  blockers: string[];
  requiredHumanApproval: true;
}

export function previewSurfaces(lanes: PlatformLane[]): PreviewSurface[] {
  const result: PreviewSurface[] = [];
  for (const lane of lanes) {
    if (lane === "web") result.push({ lane, target: "browser-preview", kind: "preview-url", requiresExplicitCredentials: false });
    if (lane === "android") result.push({ lane, target: "android-emulator-adb", kind: "emulator", requiresExplicitCredentials: false });
    if (lane === "android") result.push({ lane, target: "cloud-device-testing", kind: "device", requiresExplicitCredentials: true });
    if (lane === "ios") result.push({ lane, target: "ios-simulator", kind: "simulator", requiresExplicitCredentials: false });
    if (lane === "ios") result.push({ lane, target: "ios-beta-distribution", kind: "beta", requiresExplicitCredentials: true });
    if (lane === "desktop") result.push({ lane, target: "packaged-local-preview", kind: "local", requiresExplicitCredentials: false });
    if (lane === "game-xr") result.push({ lane, target: "engine-device-or-local-preview", kind: "device", requiresExplicitCredentials: false });
  }
  return result;
}

export function assessReleaseReadiness(results: ExecutionResult[]): ReleaseReadiness {
  const blockers: string[] = [];
  const failed = results.filter((r) => r.status === "failed");
  const pending = results.filter((r) => r.status === "planned");
  if (failed.length) blockers.push(`${failed.length} execution step(s) failed`);
  if (pending.length) blockers.push(`${pending.length} execution step(s) not yet run`);
  const total = Math.max(results.length, 1);
  const passed = results.filter((r) => r.status === "passed").length;
  const score = Math.round((passed / total) * 100);
  return { score, readyForCandidate: blockers.length === 0 && passed > 0, blockers, requiredHumanApproval: true };
}
