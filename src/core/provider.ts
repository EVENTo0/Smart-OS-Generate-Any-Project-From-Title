import type { ProviderName } from "./types";

export interface ProviderRequest {
  task: string;
  system?: string;
  input: unknown;
  requireStructuredOutput?: boolean;
}

export interface ProviderResult<T = unknown> {
  provider: ProviderName;
  model: string;
  output: T;
  latencyMs?: number;
  estimatedCost?: number;
}

export interface AIProvider {
  name: ProviderName;
  run<T = unknown>(request: ProviderRequest): Promise<ProviderResult<T>>;
}
