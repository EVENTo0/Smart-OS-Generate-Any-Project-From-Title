import { selectMobileStrategy } from "./mobile-strategy";
import type { MobileStrategyInput } from "./mobile-strategy-types";
import { createMobilePackagePlan } from "./mobile-package-plan";

export function createMobilePackageStage(input: MobileStrategyInput) {
  const decision = selectMobileStrategy(input);
  const plan = createMobilePackagePlan(decision.primary);
  return { decision, plan };
}
