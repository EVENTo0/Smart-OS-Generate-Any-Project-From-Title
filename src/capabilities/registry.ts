export type ProviderId = "openai" | "anthropic" | "kimi" | "gemini" | "antigravity" | "llama" | "qwen" | "local";

export interface Capability {
  id: string;
  provider: ProviderId;
  kind: "model" | "agent" | "runtime" | "toolchain";
  tags: string[];
  local: boolean;
  writeScope: "none" | "workspace" | "explicit-export-target";
  quality: number;
  cost: number;
  latency: number;
  availability: number;
  privacy: number;
}

export const capabilityRegistry: Capability[] = [
  { id: "openai", provider: "openai", kind: "model", tags: ["reasoning","coding","tools","research"], local: false, writeScope: "workspace", quality: 5, cost: 3, latency: 4, availability: 5, privacy: 3 },
  { id: "claude-code", provider: "anthropic", kind: "agent", tags: ["coding","repo","terminal"], local: false, writeScope: "workspace", quality: 5, cost: 3, latency: 4, availability: 5, privacy: 3 },
  { id: "kimi", provider: "kimi", kind: "model", tags: ["reasoning","long-context"], local: false, writeScope: "none", quality: 4, cost: 4, latency: 4, availability: 4, privacy: 3 },
  { id: "gemini", provider: "gemini", kind: "model", tags: ["reasoning","coding","tools","multimodal","google-search"], local: false, writeScope: "workspace", quality: 5, cost: 4, latency: 5, availability: 5, privacy: 3 },
  { id: "antigravity", provider: "antigravity", kind: "agent", tags: ["coding","browser","terminal","sandbox","files"], local: false, writeScope: "workspace", quality: 5, cost: 3, latency: 4, availability: 4, privacy: 4 },
  { id: "llama-local", provider: "llama", kind: "runtime", tags: ["local","offline","privacy"], local: true, writeScope: "none", quality: 4, cost: 5, latency: 3, availability: 3, privacy: 5 },
  { id: "qwen-local", provider: "qwen", kind: "runtime", tags: ["local","offline","coding","privacy"], local: true, writeScope: "none", quality: 4, cost: 5, latency: 4, availability: 4, privacy: 5 },
];