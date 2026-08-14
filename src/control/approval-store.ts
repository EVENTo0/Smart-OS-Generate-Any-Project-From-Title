import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { ControlApprovalView } from "./approval-view";

function assertInside(base: string, target: string): void {
  const normalizedBase = resolve(base);
  const normalizedTarget = resolve(target);
  if (normalizedTarget !== normalizedBase && !normalizedTarget.startsWith(`${normalizedBase}${sep}`)) {
    throw new Error("Control approval path escaped control-app root");
  }
}

export async function writeControlApprovalView(input: {
  repositoryRoot: string;
  view: ControlApprovalView;
}): Promise<string> {
  if (input.view.browserCanSelfApprove || input.view.containsVerifierCredential || input.view.containsOpaqueProof) {
    throw new Error("Unsafe approval view cannot be materialized for the browser");
  }

  const controlRoot = resolve(input.repositoryRoot, "control-app");
  const target = resolve(controlRoot, "approval-request.json");
  assertInside(controlRoot, target);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(input.view, null, 2)}\n`, "utf8");
  return target;
}
