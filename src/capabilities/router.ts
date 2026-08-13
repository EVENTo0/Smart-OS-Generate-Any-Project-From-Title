import { capabilityRegistry, type Capability } from "./registry";

export interface CapabilityRequest {
  requiredTags: string[];
  preferLocal?: boolean;
  requireWorkspaceWrite?: boolean;
}

function score(item: Capability, request: CapabilityRequest): number {
  const missing = request.requiredTags.filter((tag) => !item.tags.includes(tag));
  if (missing.length) return Number.NEGATIVE_INFINITY;
  if (request.requireWorkspaceWrite && item.writeScope === "none") return Number.NEGATIVE_INFINITY;
  return item.quality * 4 + item.availability * 3 + item.privacy * 2 + item.cost + item.latency + (request.preferLocal && item.local ? 8 : 0);
}

export function selectCapability(request: CapabilityRequest, registry: Capability[] = capabilityRegistry): Capability {
  const ranked = registry
    .map((item) => ({ item, score: score(item, request) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id));
  if (!ranked.length) throw new Error(`No capability satisfies: ${request.requiredTags.join(",")}`);
  return ranked[0].item;
}