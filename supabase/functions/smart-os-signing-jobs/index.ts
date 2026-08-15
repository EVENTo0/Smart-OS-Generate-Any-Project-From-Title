import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const U = Deno.env.get("SUPABASE_URL") ?? "";
function extract(raw: string | undefined, prefixes: string[]): string | null {
  if (!raw) return null;
  if (prefixes.some((p) => raw.startsWith(p)) || raw.split(".").length === 3) return raw;
  try {
    const parsed = JSON.parse(raw);
    const walk = (value: unknown): string | null => {
      if (typeof value === "string" && (prefixes.some((p) => value.startsWith(p)) || value.split(".").length === 3)) return value;
      if (Array.isArray(value)) for (const item of value) { const found = walk(item); if (found) return found; }
      if (value && typeof value === "object") for (const item of Object.values(value as Record<string, unknown>)) { const found = walk(item); if (found) return found; }
      return null;
    };
    return walk(parsed);
  } catch { return null; }
}
const PK = extract(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), ["sb_publishable_"]) ?? extract(Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), ["sb_publishable_"]) ?? extract(Deno.env.get("SUPABASE_ANON_KEY"), ["eyJ"]) ?? "";
const SK = extract(Deno.env.get("SUPABASE_SECRET_KEYS"), ["sb_secret_"]) ?? extract(Deno.env.get("SUPABASE_SECRET_KEY"), ["sb_secret_"]) ?? extract(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ["eyJ"]) ?? "";
const C = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-smartos-runner-token", "Access-Control-Allow-Methods": "POST,OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store" };
const ID = /^[A-Za-z0-9._:-]+$/;
const UUID = /^[0-9a-f-]{36}$/i;
const SHA256 = /^sha256:[0-9a-f]{64}$/i;
const GIT = /^[0-9a-f]{40}$/i;
const MATERIALIZERS = new Set(["snake-capacitor-v1"]);
const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: C });
async function hash(value: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return "sha256:" + [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function serviceHeaders(extra: Record<string, string> = {}) { const h: Record<string, string> = { apikey: SK, "Content-Type": "application/json", ...extra }; if (SK.split(".").length === 3) h.Authorization = `Bearer ${SK}`; return h; }
async function rest(path: string, init: RequestInit = {}) { return fetch(`${U}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> ?? {}) } }); }
async function getUser(req: Request) { const auth = req.headers.get("authorization") ?? ""; if (!auth.toLowerCase().startsWith("bearer ") || !PK) return null; const r = await fetch(`${U}/auth/v1/user`, { headers: { apikey: PK, Authorization: auth } }); if (!r.ok) return null; const d = await r.json(); return d?.id ? { id: d.id } : null; }
async function runnerCredential(req: Request, runnerId: string) { const token = req.headers.get("x-smartos-runner-token") ?? ""; if (!ID.test(runnerId) || token.length < 32) return null; const q = new URLSearchParams({ runner_id: `eq.${runnerId}`, credential_hash: `eq.${await hash(token)}`, revoked_at: "is.null", expires_at: `gt.${new Date().toISOString()}`, select: "credential_id" }); const r = await rest(`smart_os_runner_credentials?${q}`); return r.ok ? (await r.json())[0] ?? null : null; }
function sourceBindingValid(version: number, digest: unknown) { return version === 1 ? digest == null : version === 2 && SHA256.test(String(digest ?? "")); }
function fullToolchain(lane: string, row: any) { const tools = new Set(Array.isArray(row.tools) ? row.tools.map(String) : []); return lane === "android" ? (tools.has("gradle") || tools.has("./gradlew")) && tools.has("jarsigner") && tools.has("git") && tools.has("node") && tools.has("npm") : row.host_platform === "macos" && tools.has("xcodebuild") && tools.has("security") && tools.has("git") && tools.has("node") && tools.has("npm"); }
async function availableRunner(lane: string, requested?: string) { const now = Date.now(); const q = new URLSearchParams({ lane: `eq.${lane}`, state: "eq.available", select: "attestation_id,runner_id,lane,host_platform,tools,provider_handle_id,state,expires_at,last_heartbeat_at,public_publish_authorized,store_upload_authorized" }); if (requested) q.set("runner_id", `eq.${requested}`); const r = await rest(`smart_os_signing_runner_attestations?${q}`); if (!r.ok) throw new Error("runner lookup failed"); return (await r.json()).find((row: any) => row.public_publish_authorized === false && row.store_upload_authorized === false && row.last_heartbeat_at && now - Date.parse(row.last_heartbeat_at) <= 600000 && Date.parse(row.expires_at) > now && fullToolchain(lane, row)) ?? null; }
async function provider(handleId: string) { const q = new URLSearchParams({ handle_id: `eq.${handleId}`, verification: "eq.verified", exposes_secret_values: "eq.false", select: "handle_id,lane,required_secret_refs" }); const r = await rest(`smart_os_signing_provider_handles?${q}`); return r.ok ? (await r.json())[0] ?? null : null; }
async function provenance(rc: string, lane: string) { const q = new URLSearchParams({ release_candidate_id: `eq.${rc}`, lane: `eq.${lane}`, public_publish_authorized: "eq.false", store_upload_authorized: "eq.false", select: "provenance_id,lane,source_commit_sha,generator_path,generator_blob_sha,materializer_id,evidence_run_ids,source_manifest_digest" }); const r = await rest(`smart_os_release_candidate_lane_provenance?${q}`); if (!r.ok) throw new Error("provenance lookup failed"); const p = (await r.json())[0] ?? null; return p && GIT.test(p.source_commit_sha) && GIT.test(p.generator_blob_sha) && p.generator_path === "src/implementation/generator.ts" && MATERIALIZERS.has(p.materializer_id) && (p.source_manifest_digest == null || SHA256.test(p.source_manifest_digest)) ? p : null; }
function spec(lane: string, project: string, version: string, materializer: string) { const v = version.replace(/[^A-Za-z0-9._-]/g, "-"); return lane === "android" ? { command: { executable: "smart-os-sign-android", args: [`source-bound:${materializer}`], workingDirectory: "." }, outputPath: `signed/${project}/${v}/android/app-release.aab` } : { command: { executable: "smart-os-sign-ios", args: [`source-bound:${materializer}`], workingDirectory: "." }, outputPath: `signed/${project}/${v}/ios/SmartOS.xcarchive` }; }

async function issue(req: Request, body: any) {
  const user = await getUser(req); if (!user) return respond(401, { error: "authenticated SMART OS user required" });
  const rc = String(body.releaseCandidateId ?? ""), lane = String(body.lane ?? ""), requested = body.runnerId ? String(body.runnerId) : undefined;
  if (!UUID.test(rc) || !["android", "ios"].includes(lane) || (requested && !ID.test(requested))) return respond(400, { error: "invalid signing job scope" });
  const q = new URLSearchParams({ release_candidate_id: `eq.${rc}`, status: "eq.promoted", public_publish_authorized: "eq.false", select: "release_candidate_id,project_id,version,candidate_fingerprint,approved_by,target_lanes,approval_schema_version,source_manifest_digest" });
  const rr = await rest(`smart_os_release_candidates?${q}`); if (!rr.ok) return respond(500, { error: "release candidate lookup failed" }); const candidate = (await rr.json())[0];
  if (!candidate || candidate.approved_by !== user.id || !Array.isArray(candidate.target_lanes) || !candidate.target_lanes.includes(lane) || !SHA256.test(candidate.candidate_fingerprint) || !sourceBindingValid(candidate.approval_schema_version, candidate.source_manifest_digest)) return respond(403, { error: "release candidate is not approved with a valid source binding for this user and lane" });
  const source = await provenance(rc, lane); if (!source) return respond(409, { error: "verified immutable source provenance is required before signing" });
  if (source.source_manifest_digest !== candidate.source_manifest_digest) return respond(409, { error: "lane provenance source manifest digest does not match release candidate" });
  const runner = await availableRunner(lane, requested); if (!runner) return respond(409, { error: "no fresh available signing runner with complete toolchain for lane" });
  const signingProvider = await provider(runner.provider_handle_id); if (!signingProvider || signingProvider.lane !== lane) return respond(409, { error: "runner signing provider is not verified" });
  const s = spec(lane, candidate.project_id, candidate.version, source.materializer_id);
  const payload = { release_candidate_id: candidate.release_candidate_id, project_id: candidate.project_id, version: candidate.version, candidate_fingerprint: candidate.candidate_fingerprint, lane, runner_id: runner.runner_id, provider_handle_id: runner.provider_handle_id, source_provenance_id: source.provenance_id, source_manifest_digest: candidate.source_manifest_digest, source_commit_sha: source.source_commit_sha, generator_blob_sha: source.generator_blob_sha, materializer_id: source.materializer_id, command: s.command, output_path: s.outputPath, secret_refs: Array.isArray(signingProvider.required_secret_refs) ? signingProvider.required_secret_refs : [], status: "queued", created_by: user.id, public_publish_authorized: false, store_upload_authorized: false };
  const r = await rest("smart_os_signing_jobs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) }); if (r.status === 409) return respond(409, { error: "an active signing job already exists for this release candidate lane" }); if (!r.ok) return respond(500, { error: "signing job issuance failed" }); const job = (await r.json())[0];
  return respond(200, { jobId: job.job_id, releaseCandidateId: job.release_candidate_id, lane: job.lane, runnerId: job.runner_id, status: job.status, sourceBound: candidate.approval_schema_version === 2, sourceCommitSha: job.source_commit_sha, generatorBlobSha: job.generator_blob_sha, materializerId: job.materializer_id, outputPath: job.output_path, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

async function next(req: Request, body: any) {
  const runnerId = String(body.runnerId ?? ""); if (!await runnerCredential(req, runnerId)) return respond(401, { error: "valid runner credential required" }); const now = new Date();
  await rest(`smart_os_signing_jobs?runner_id=eq.${encodeURIComponent(runnerId)}&status=eq.leased&lease_expires_at=lt.${encodeURIComponent(now.toISOString())}`, { method: "PATCH", body: JSON.stringify({ status: "queued", leased_at: null, lease_expires_at: null }) });
  const q = new URLSearchParams({ runner_id: `eq.${runnerId}`, status: "eq.queued", select: "job_id,release_candidate_id,project_id,version,candidate_fingerprint,lane,runner_id,provider_handle_id,source_provenance_id,source_manifest_digest,source_commit_sha,generator_blob_sha,materializer_id,command,output_path,status,created_at", order: "created_at.asc", limit: "1" }); const r = await rest(`smart_os_signing_jobs?${q}`); if (!r.ok) return respond(500, { error: "job queue lookup failed" }); const job = (await r.json())[0]; if (!job) return respond(200, { noJob: true, publicPublishAuthorized: false, storeUploadAuthorized: false });
  if (!GIT.test(job.source_commit_sha) || !GIT.test(job.generator_blob_sha) || !MATERIALIZERS.has(job.materializer_id) || (job.source_manifest_digest != null && !SHA256.test(job.source_manifest_digest))) return respond(409, { error: "queued signing job source provenance is invalid" });
  const leaseExpiresAt = new Date(Date.now() + 600000).toISOString(); const p = await rest(`smart_os_signing_jobs?job_id=eq.${job.job_id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "leased", leased_at: now.toISOString(), lease_expires_at: leaseExpiresAt }) }); if (!p.ok || (await p.json()).length !== 1) return respond(409, { error: "job was leased concurrently" }); return respond(200, { ...job, status: "leased", sourceBound: job.source_manifest_digest != null, leaseExpiresAt, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

async function complete(req: Request, body: any) {
  const runnerId = String(body.runnerId ?? ""), jobId = String(body.jobId ?? ""), result = String(body.result ?? ""), sourceCommitSha = String(body.sourceCommitSha ?? ""), generatorBlobSha = String(body.generatorBlobSha ?? ""), materializerId = String(body.materializerId ?? ""), artifactSha256 = body.artifactSha256 ? String(body.artifactSha256) : null, artifactSizeBytes = Number.isFinite(Number(body.artifactSizeBytes)) ? Number(body.artifactSizeBytes) : null, resultSummary = String(body.resultSummary ?? "").slice(0, 1000);
  if (!await runnerCredential(req, runnerId)) return respond(401, { error: "valid runner credential required" }); if (!UUID.test(jobId) || !["succeeded", "failed"].includes(result) || !GIT.test(sourceCommitSha) || !GIT.test(generatorBlobSha) || !MATERIALIZERS.has(materializerId)) return respond(400, { error: "invalid signing completion provenance" }); if (result === "succeeded" && (!artifactSha256 || !SHA256.test(artifactSha256) || artifactSizeBytes === null || artifactSizeBytes < 0)) return respond(400, { error: "successful signing completion requires artifact digest and size" });
  const now = new Date().toISOString(), q = `smart_os_signing_jobs?job_id=eq.${jobId}&runner_id=eq.${encodeURIComponent(runnerId)}&status=eq.leased&lease_expires_at=gt.${encodeURIComponent(now)}&source_commit_sha=eq.${sourceCommitSha}&generator_blob_sha=eq.${generatorBlobSha}&materializer_id=eq.${encodeURIComponent(materializerId)}`;
  const p = await rest(q, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: result, completed_at: now, artifact_sha256: artifactSha256, artifact_size_bytes: artifactSizeBytes, result_summary: resultSummary }) }); if (!p.ok) return respond(500, { error: "signing completion update failed" }); const updated = (await p.json())[0]; if (!updated) return respond(409, { error: "signing job lease or source provenance is invalid" }); return respond(200, { jobId: updated.job_id, status: updated.status, artifactSha256: updated.artifact_sha256, artifactSizeBytes: updated.artifact_size_bytes, sourceCommitSha, generatorBlobSha, materializerId, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: C });
  if (!U || !PK || !SK) return respond(503, { error: "signing jobs gateway environment is incomplete" });
  try { const body = await req.json().catch(() => ({})), action = String(body.action ?? ""); if (action === "issue-job") return issue(req, body); if (action === "next-job") return next(req, body); if (action === "complete-job") return complete(req, body); return respond(400, { error: "unsupported signing job action" }); }
  catch (error) { console.error("smart-os-signing-jobs", error instanceof Error ? error.message : "unknown"); return respond(500, { error: "signing jobs gateway internal error" }); }
});
