import type { CommandDescriptor, PlatformLane } from "./types";

export interface PlatformAdapter {
  lane: PlatformLane;
  matches(platform: string): boolean;
  plan(projectId: string, workspaceRoot: string): CommandDescriptor[];
}

const wd = (root: string) => `${root}/build`;

export const platformAdapters: PlatformAdapter[] = [
  {
    lane: "web",
    matches: (p) => /web|pwa/i.test(p),
    plan: (_id, root) => [
      { id: "web-build", lane: "web", executable: "node", args: ["--check", "src/main.js"], workingDirectory: wd(root), purpose: "build" },
      { id: "web-test", lane: "web", executable: "node", args: ["--test", "tests/smoke.test.mjs"], workingDirectory: wd(root), purpose: "test" },
    ],
  },
  {
    lane: "android",
    matches: (p) => /android/i.test(p),
    plan: (_id, root) => [
      { id: "android-build", lane: "android", executable: "./gradlew", args: ["assembleDebug"], workingDirectory: wd(root), purpose: "build" },
      { id: "android-test", lane: "android", executable: "./gradlew", args: ["test"], workingDirectory: wd(root), purpose: "test" },
    ],
  },
  {
    lane: "ios",
    matches: (p) => /ios|iphone|ipad/i.test(p),
    plan: (_id, root) => [
      { id: "ios-build", lane: "ios", executable: "xcodebuild", args: ["build"], workingDirectory: wd(root), purpose: "build" },
      { id: "ios-test", lane: "ios", executable: "xcodebuild", args: ["test"], workingDirectory: wd(root), purpose: "test" },
    ],
  },
  {
    lane: "desktop",
    matches: (p) => /pc|windows|macos|linux|desktop/i.test(p),
    plan: (_id, root) => [
      { id: "desktop-build", lane: "desktop", executable: "npm", args: ["run", "build"], workingDirectory: wd(root), purpose: "build" },
      { id: "desktop-test", lane: "desktop", executable: "npm", args: ["test"], workingDirectory: wd(root), purpose: "test" },
    ],
  },
  {
    lane: "game-xr",
    matches: (p) => /game|vr|xr|quest|unreal|unity/i.test(p),
    plan: (_id, root) => [
      { id: "game-build", lane: "game-xr", executable: "engine-build", args: ["--project", "."], workingDirectory: wd(root), purpose: "build" },
      { id: "game-smoke", lane: "game-xr", executable: "engine-test", args: ["--smoke"], workingDirectory: wd(root), purpose: "test" },
    ],
  },
];

export function adaptersForPlatforms(platforms: string[]): PlatformAdapter[] {
  const selected = platformAdapters.filter((adapter) => platforms.some((platform) => adapter.matches(platform)));
  return selected.length ? selected : [platformAdapters[0]];
}
