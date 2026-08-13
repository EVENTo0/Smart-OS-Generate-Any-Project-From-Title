import { mobileStrategyCatalog } from "./mobile-strategy-catalog";
import type { MobileStrategyInput } from "./mobile-strategy-types";

export function rankMobileStrategies(input: MobileStrategyInput) {
  return mobileStrategyCatalog
    .map((profile) => {
      let score = 0;
      const supportsTargets = input.targetPlatforms.every((target) => profile.platforms.includes(target.toLowerCase()));
      if (supportsTargets) score += 10;
      if (profile.webFirst === input.webFirst) score += 4;
      if (profile.nativeApiAccess === input.requiresNativeApis) score += 3;
      if (profile.nativePackage === input.requiresStorePackage) score += 3;
      return { id: profile.id, score, supportsTargets };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
