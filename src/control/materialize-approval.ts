import type { ReleaseApprovalRequest } from "../approval/release-approval";
import { createControlApprovalView, type ControlApprovalView } from "./approval-view";
import { writeControlApprovalView } from "./approval-store";

export interface MaterializedApprovalRequest {
  view: ControlApprovalView;
  path: string;
}

export async function materializeApprovalRequest(input: {
  repositoryRoot: string;
  request: ReleaseApprovalRequest;
}): Promise<MaterializedApprovalRequest> {
  const view = createControlApprovalView(input.request);
  const path = await writeControlApprovalView({ repositoryRoot: input.repositoryRoot, view });
  return { view, path };
}
