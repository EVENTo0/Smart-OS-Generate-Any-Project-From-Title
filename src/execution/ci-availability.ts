export type CiState = "available" | "blocked-external" | "failed";

export function classifyCiState(jobStarted: boolean, billingBlocked: boolean): CiState {
  if (!jobStarted && billingBlocked) return "blocked-external";
  return jobStarted ? "available" : "failed";
}
