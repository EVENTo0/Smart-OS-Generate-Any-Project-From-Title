import { selectMobileStrategy } from "./mobile-strategy";
import type { MobileStrategyDecision, MobileStrategyInput } from "./mobile-strategy-types";
import { routeNativeRunners, type NativeRunnerRoute } from "../execution/native-routing";
import type { NativeToolchainProbe } from "../execution/native-types";

export interface MobilePackagingManifest {
  projectId: string;
  decision: MobileStrategyDecision;
  nativeRoutes: NativeRunnerRoute[];
  packageReady: boolean;
  blockers: string[];
  storePublicationByDefault: false;
}

export function createMobilePackagingManifest(
  projectId: string,
  input: MobileStrategyInput,
  probes: NativeToolchainProbe[] = [],
): MobilePackagingManifest {
  const decision = selectMobileStrategy(input);
  const nativeRoutes = routeNativeRunners(decision.primary, probes);
  const blockers = [
    ...decision.blockers,
    ...nativeRoutes.flatMap((route) => route.blockers.map((blocker) => `${route.platform}: ${blocker}`)),
  ];
  const nativeRequired = nativeRoutes.length > 0;
  const packageReady = decision.blockers.length === 0 && (!nativeRequired || nativeRoutes.every((route) => route.buildRunnable));
  return {
    projectId,
    decision,
    nativeRoutes,
    packageReady,
    blockers,
    storePublicationByDefault: false,
  };
}
