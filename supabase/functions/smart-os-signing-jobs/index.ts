import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function extractKey(raw: string | undefined, prefixes: string[]): string | null {
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

const PUBLISHABLE_KEY = extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), ["sb_publishable_"]) ?? extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), ["sb_publishable_"]) ?? extractKey(Deno.env.get("SUPABASE_ANON_KEY"), ["eyJ"]) ?? "";
const SERVICE_KEY = extractKey(Deno.env.get("SUPABASE_SECRET_KEYS"), ["sb_secret_"]) ?? extractKey(Deno.env.get("SUPABASE_SECRET_KEY"), ["sb_secret_"]) ?? extractKey(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ["eyJ"]) ?? "";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-smartos-runner-token",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const SAFE_ID = /^[A-Za-z0-9._:-]+$/;
const UUID = /^[0-9a-f-]{36}$/i;
const SHA256 = /^sha256:[0-9a-f]{64}$/i;
const GIT_SHA = /^[0-9a-f]{40}$/i;
const SUPPORTED_MATERIALIZERS = new Set(["snake-capacitor-v1"]);

function json(status: number, body: unknown) { return new Response(JSON.stringify(body), { status, headers: cors }); }
async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return "sha256:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function serviceHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  if (SERVICE_KEY.split(".").length === 3) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}
async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> ?? {}) } });
}
async function getUser(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") || !PUBLISHABLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: PUBLISHABLE_KEY, Authorization: auth } });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.id ? { id: data.id } : null;
}
async function runnerCredential(req: Request, runnerId: string) {
  const token = req.headers.get("x-smartos-runner-token") ?? "";
  if (!SAFE_ID.test(runnerId) || token.length < 32) return null;
  const hash = await sha256(token);
  const now = new Date().toISOString();
  const query = new URLSearchParams({ runner_id: `eq.${runnerId}`, credential_hash: `eq.${hash}`, revoked_at: "is.null", expires_at: `gt.${now}`, select: "credential_id,enrollment_id,expires_at" });
  const response = await rest(`smart_os_runner_credentials?${query}`);
  return response.ok ? (await response.json())[0] ?? null : null;
}
function hasFullToolchain(lane: string, row: any) {
  const tools = new Set(Array.isArray(row.tools) ? row.tools.map(String) : []);
  if (lane === "android") return (tools.has("gradle") || tools.has("./gradlew")) && tools.has("jarsigner") && tools.has("git") && tools.has("node") && tools.has("npm");
  return row.host_platform === "macos" && tools.has("xcodebuild") && tools.has("security") && tools.has("git") && tools.has("node") && tools.has("npm");
}
async function availableRunner(lane: string, requestedRunnerId?: string) {
  const now = Date.now();
  const query = new URLSearchParams({ lane: `eq.${lane}`, state: "eq.available", select: "attestation_id,runner_id,lane,host_platform,tools,provider_handle_id,state,expires_at,last_heartbeat_at,public_publish_authorized,store_upload_authorized" });
  if (requestedRunnerId) query.set("runner_id", `eq.${requestedRunnerId}`);
  const response = await rest(`smart_os_signing_runner_attestations?${query}`);
  if (!response.ok) throw new Error("runner lookup failed");
  const rows = await response.json();
  return rows.find((row: any) => row.public_publish_authorized === false && row.store_upload_authorized === false && row.last_heartbeat_at && now - Date.parse(row.last_heartbeat_at) <= 600000 && Date.parse(row.expires_at) > now && hasFullToolchain(lane, row)) ?? null;
}
async function provider(handleId: string) {
  const query = new URLSearchParams({ handle_id: `eq.${handleId}`, verification: "eq.verified", exposes_secret_values: "eq.false", select: "handle_id,lane,provider,required_secret_refs,verification,exposes_secret_values" });
  const response = await rest(`smart_os_signing_provider_handles?${query}`);
  if (!response.ok) throw new Error("provider lookup failed");
  return (await response.json())[0] ?? null;
}
async function provenance(releaseCandidateId: string, lane: string) {
  const query = new URLSearchParams({
    release_candidate_id: `eq.${releaseCandidateId}`,
    lane: `eq.${lane}`,
    public_publish_authorized: "eq.false",
    store_upload_authorized: "eq.false",
    select: "provenance_id,lane,source_commit_sha,generator_path,generator_blob_sha,materializer_id,evidence_run_ids,verification_source,verified_at,public_publish_authorized,store_upload_authorized",
  });
  const response = await rest(`smart_os_release_candidate_lane_provenance?${query}`);
  if (!response.ok) throw new Error("release candidate lane provenance lookup failed");
  const row = (await response.json())[0] ?? null;
  if (!row || !GIT_SHA.test(row.source_commit_sha) || !GIT_SHA.test(row.generator_blob_sha) || row.generator_path !== "src/implementation/generator.ts" || !SUPPORTED_MATERIALIZERS.has(row.materializer_id)) return null;
  return row;
}
function commandFor(lane: string, projectId: string, version: string, materializerId: string) {
  const safeVersion = version.replace(/[^A-Za-z0-9._-]/g, "-");
  if (lane === "android") return {
    command: { executable: "smart-os-sign-android", args: [`source-bound:${materializerId}`], workingDirectory: "." },
    outputPath: `signed/${projectId}/${safeVersion}/android/app-release.aab`,
  };
  return {
    command: { executable: "smart-os-sign-ios", args: [`source-bound:${materializerId}`], workingDirectory: "." },
    outputPath: `signed/${projectId}/${safeVersion}/ios/SmartOS.xcarchive`,
  };
}

async function issueJob(req: Request, body: any) {
  const user = await getUser(req);
  if (!user) return json(401, { error: "authenticated SMART OS user required" });
  const releaseCandidateId = String(body.releaseCandidateId ?? "");
  const lane = String(body.lane ?? "");
  const requestedRunnerId = body.runnerId ? String(body.runnerId) : undefined;
  if (!UUID.test(releaseCandidateId) || !["android", "ios"].includes(lane) || (requestedRunnerId && !SAFE_ID.test(requestedRunnerId))) return json(400, { error: "invalid signing job scope" });

  const candidateQuery = new URLSearchParams({ release_candidate_id: `eq.${releaseCandidateId}`, status: "eq.promoted", public_publish_authorized: "eq.false", select: "release_candidate_id,project_id,version,candidate_fingerprint,approval_request_id,approved_by,target_lanes,status,public_publish_authorized" });
  const candidateResponse = await rest(`smart_os_release_candidates?${candidateQuery}`);
  if (!candidateResponse.ok) return json(500, { error: "release candidate lookup failed" });
  const candidate = (await candidateResponse.json())[0];
  if (!candidate || candidate.approved_by !== user.id || !Array.isArray(candidate.target_lanes) || !candidate.target_lanes.includes(lane) || !SHA256.test(candidate.candidate_fingerprint)) return json(403, { error: "release candidate is not approved for this user and lane" });

  const source = await provenance(releaseCandidateId, lane);
  if (!source) return json(409, { error: "verified immutable source provenance is required before signing" });
  const runner = await availableRunner(lane, requestedRunnerId);
  if (!runner) return json(409, { error: "no fresh available signing runner with complete toolchain for lane" });
  const signingProvider = await provider(runner.provider_handle_id);
  if (!signingProvider || signingProvider.lane !== lane) return json(409, { error: "runner signing provider is not verified" });

  const spec = commandFor(lane, candidate.project_id, candidate.version, source.materializer_id);
  const payload = {
    release_candidate_id: candidate.release_candidate_id,
    project_id: candidate.project_id,
    version: candidate.version,
    candidate_fingerprint: candidate.candidate_fingerprint,
    lane,
    runner_id: runner.runner_id,
    provider_handle_id: runner.provider_handle_id,
    source_provenance_id: source.provenance_id,
    source_commit_sha: source.source_commit_sha,
    generator_blob_sha: source.generator_blob_sha,
    materializer_id: source.materializer_id,
    command: spec.command,
    output_path: spec.outputPath,
    secret_refs: Array.isArray(signingProvider.required_secret_refs) ? signingProvider.required_secret_refs : [],
    status: "queued",
    created_by: user.id,
    public_publish_authorized: false,
    store_upload_authorized: false,
  };
  const response = await rest("smart_os_signing_jobs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload) });
  if (response.status === 409) return json(409, { error: "an active signing job already exists for this release candidate lane" });
  if (!response.ok) return json(500, { error: "signing job issuance failed" });
  const job = (await response.json())[0];
  return json(200, {
    jobId: job.job_id,
    releaseCandidateId: job.release_candidate_id,
    lane: job.lane,
    runnerId: job.runner_id,
    status: job.status,
    sourceCommitSha: job.source_commit_sha,
    generatorBlobSha: job.generator_blob_sha,
    materializerId: job.materializer_id,
    outputPath: job.output_path,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  });
}

async function nextJob(req: Request, body: any) {
  const runnerId = String(body.runnerId ?? "");
  if (!await runnerCredential(req, runnerId)) return json(401, { error: "valid runner credential required" });
  const now = new Date();
  await rest(`smart_os_signing_jobs?runner_id=eq.${encodeURIComponent(runnerId)}&status=eq.leased&lease_expires_at=lt.${encodeURIComponent(now.toISOString())}`, { method: "PATCH", body: JSON.stringify({ status: "queued", leased_at: null, lease_expires_at: null }) });
  const query = new URLSearchParams({ runner_id: `eq.${runnerId}`, status: "eq.queued", select: "job_id,release_candidate_id,project_id,version,candidate_fingerprint,lane,runner_id,provider_handle_id,source_provenance_id,source_commit_sha,generator_blob_sha,materializer_id,command,output_path,status,created_at", order: "created_at.asc", limit: "1" });
  const response = await rest(`smart_os_signing_jobs?${query}`);
  if (!response.ok) return json(500, { error: "job queue lookup failed" });
  const job = (await response.json())[0];
  if (!job) return json(200, { noJob: true, publicPublishAuthorized: false, storeUploadAuthorized: false });
  if (!GIT_SHA.test(job.source_commit_sha) || !GIT_SHA.test(job.generator_blob_sha) || !SUPPORTED_MATERIALIZERS.has(job.materializer_id)) return json(409, { error: "queued signing job source provenance is invalid" });
  const leaseExpiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const patch = await rest(`smart_os_signing_jobs?job_id=eq.${job.job_id}&status=eq.queued`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "leased", leased_at: now.toISOString(), lease_expires_at: leaseExpiresAt }) });
  if (!patch.ok || (await patch.json()).length !== 1) return json(409, { error: "job was leased concurrently" });
  return json(200, { ...job, status: "leased", leaseExpiresAt, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

async function completeJob(req: Request, body: any) {
  const runnerId = String(body.runnerId ?? "");
  const jobId = String(body.jobId ?? "");
  const result = String(body.result ?? "");
  const sourceCommitSha = String(body.sourceCommitSha ?? "");
  const generatorBlobSha = String(body.generatorBlobSha ?? "");
  const materializerId = String(body.materializerId ?? "");
  const artifactSha256 = body.artifactSha256 ? String(body.artifactSha256) : null;
  const artifactSizeBytes = Number.isFinite(Number(body.artifactSizeBytes)) ? Number(body.artifactSizeBytes) : null;
  const resultSummary = String(body.resultSummary ?? "").slice(0, 1000);
  if (!await runnerCredential(req, runnerId)) return json(401, { error: "valid runner credential required" });
  if (!UUID.test(jobId) || !["succeeded", "failed"].includes(result) || !GIT_SHA.test(sourceCommitSha) || !GIT_SHA.test(generatorBlobSha) || !SUPPORTED_MATERIALIZERS.has(materializerId)) return json(400, { error: "invalid signing completion provenance" });
  if (result === "succeeded" && (!artifactSha256 || !SHA256.test(artifactSha256) || artifactSizeBytes === null || artifactSizeBytes < 0)) return json(400, { error: "successful signing completion requires artifact digest and size" });
  const now = new Date().toISOString();
  const query = `smart_os_signing_jobs?job_id=eq.${jobId}&runner_id=eq.${encodeURIComponent(runnerId)}&status=eq.leased&lease_expires_at=gt.${encodeURIComponent(now)}&source_commit_sha=eq.${sourceCommitSha}&generator_blob_sha=eq.${generatorBlobSha}&materializer_id=eq.${encodeURIComponent(materializerId)}`;
  const patch = await rest(query, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: result, completed_at: now, artifact_sha256: artifactSha256, artifact_size_bytes: artifactSizeBytes, result_summary: resultSummary }) });
  if (!patch.ok) return json(500, { error: "signing completion update failed" });
  const updated = (await patch.json())[0];
  if (!updated) return json(409, { error: "signing job lease or source provenance is invalid" });
  return json(200, { jobId: updated.job_id, status: updated.status, artifactSha256: updated.artifact_sha256, artifactSizeBytes: updated.artifact_size_bytes, sourceCommitSha, generatorBlobSha, materializerId, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_KEY) return json(503, { error: "signing jobs gateway environment is incomplete" });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    if (action === "issue-job") return await issueJob(req, body);
    if (action === "next-job") return await nextJob(req, body);
    if (action === "complete-job") return await completeJob(req, body);
    return json(400, { error: "unsupported signing job action" });
  } catch (error) {
    console.error("smart-os-signing-jobs error", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "signing jobs gateway internal error" });
  }
});
