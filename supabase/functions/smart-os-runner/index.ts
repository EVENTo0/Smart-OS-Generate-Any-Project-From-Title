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
  } catch {
    return null;
  }
}

const PUBLISHABLE_KEY =
  extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"), ["sb_publishable_"]) ??
  extractKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), ["sb_publishable_"]) ??
  extractKey(Deno.env.get("SUPABASE_ANON_KEY"), ["eyJ"]) ?? "";

const SERVICE_KEY =
  extractKey(Deno.env.get("SUPABASE_SECRET_KEYS"), ["sb_secret_"]) ??
  extractKey(Deno.env.get("SUPABASE_SECRET_KEY"), ["sb_secret_"]) ??
  extractKey(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), ["eyJ"]) ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-smartos-runner-token",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const SAFE_ID = /^[A-Za-z0-9._:-]+$/;
const LANES = new Set(["android", "ios"]);
const HOSTS = new Set(["linux", "macos", "windows"]);

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  for (const b of data) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return "sha256:" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function serviceHeaders(extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { apikey: SERVICE_KEY, "Content-Type": "application/json", ...extra };
  if (SERVICE_KEY.split(".").length === 3) headers.Authorization = `Bearer ${SERVICE_KEY}`;
  return headers;
}

async function rest(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...serviceHeaders(), ...(init.headers as Record<string, string> ?? {}) },
  });
}

async function getUser(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ") || !PUBLISHABLE_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: auth },
  });
  if (!response.ok) return null;
  const data = await response.json();
  return data?.id ? { id: data.id, email: data.email } : null;
}

async function provider(handleId: string) {
  const params = new URLSearchParams({ handle_id: `eq.${handleId}`, select: "handle_id,project_id,lane,provider,required_secret_refs,verification,exposes_secret_values" });
  const response = await rest(`smart_os_signing_provider_handles?${params}`);
  if (!response.ok) throw new Error(`provider lookup failed: ${response.status}`);
  return (await response.json())[0] ?? null;
}

function requiredTools(lane: string) {
  return lane === "ios" ? ["xcodebuild"] : ["gradle"];
}

function toolSatisfied(lane: string, tools: string[]) {
  if (lane === "ios") return tools.includes("xcodebuild");
  return tools.includes("gradle") || tools.includes("./gradlew");
}

async function createEnrollment(req: Request, body: any) {
  const user = await getUser(req);
  if (!user) return json(401, { error: "authenticated SMART OS user required" });

  const lane = String(body.lane ?? "");
  const projectId = String(body.projectId ?? "snake-game");
  const runnerId = String(body.runnerId ?? (lane === "ios" ? "self-hosted-macos" : "self-hosted-linux"));
  const providerHandleId = String(body.providerHandleId ?? (lane === "ios" ? "secure-local-ios" : "secure-local-android"));
  if (!LANES.has(lane) || !SAFE_ID.test(projectId) || !SAFE_ID.test(runnerId) || !SAFE_ID.test(providerHandleId)) {
    return json(400, { error: "invalid enrollment scope" });
  }
  const p = await provider(providerHandleId);
  if (!p || p.lane !== lane || p.provider !== "secure-local-runner" || p.exposes_secret_values !== false) {
    return json(409, { error: "secure local provider handle is not eligible for this lane" });
  }

  const pairingToken = randomToken(32);
  const pairingHash = await sha256(pairingToken);
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  const response = await rest("smart_os_runner_enrollments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: projectId,
      requested_by: user.id,
      runner_id: runnerId,
      lane,
      provider_handle_id: providerHandleId,
      pairing_hash: pairingHash,
      expires_at: expiresAt,
      public_publish_authorized: false,
      store_upload_authorized: false,
    }),
  });
  if (!response.ok) return json(500, { error: "failed to create runner enrollment" });
  const row = (await response.json())[0];
  return json(200, {
    enrollmentId: row.enrollment_id,
    projectId,
    lane,
    runnerId,
    providerHandleId,
    pairingToken,
    expiresAt,
    oneTimePairing: true,
    signingSecretsIncluded: false,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  });
}

async function claimEnrollment(body: any) {
  const enrollmentId = String(body.enrollmentId ?? "");
  const pairingToken = String(body.pairingToken ?? "");
  const hostPlatform = String(body.hostPlatform ?? "");
  const tools = Array.isArray(body.tools) ? [...new Set(body.tools.map(String))] : [];
  const availableSecretRefs = Array.isArray(body.availableSecretRefs) ? [...new Set(body.availableSecretRefs.map(String))] : [];
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId) || pairingToken.length < 32 || !HOSTS.has(hostPlatform)) return json(400, { error: "invalid claim" });

  const pairingHash = await sha256(pairingToken);
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    enrollment_id: `eq.${enrollmentId}`,
    pairing_hash: `eq.${pairingHash}`,
    state: "eq.pending",
    expires_at: `gt.${now}`,
    select: "enrollment_id,project_id,requested_by,runner_id,lane,provider_handle_id,expires_at",
  });
  const lookup = await rest(`smart_os_runner_enrollments?${params}`);
  if (!lookup.ok) return json(500, { error: "enrollment lookup failed" });
  const enrollment = (await lookup.json())[0];
  if (!enrollment) return json(401, { error: "pairing token invalid, expired, or already consumed" });
  if (enrollment.lane === "ios" && hostPlatform !== "macos") return json(409, { error: "iOS runner requires macOS" });
  if (!toolSatisfied(enrollment.lane, tools)) return json(409, { error: `runner is missing required tool: ${requiredTools(enrollment.lane).join(",")}` });

  const p = await provider(enrollment.provider_handle_id);
  if (!p) return json(409, { error: "signing provider handle missing" });
  const requiredRefs = Array.isArray(p.required_secret_refs) ? p.required_secret_refs.map(String) : [];
  const available = new Set(availableSecretRefs);
  const missingSecretRefs = requiredRefs.filter((name: string) => !available.has(name));

  const runnerToken = randomToken(32);
  const credentialHash = await sha256(runnerToken);
  const credentialExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();

  const consumeParams = new URLSearchParams({ enrollment_id: `eq.${enrollmentId}`, pairing_hash: `eq.${pairingHash}`, state: "eq.pending" });
  const consume = await rest(`smart_os_runner_enrollments?${consumeParams}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ state: "consumed", consumed_at: now, claimed_host_platform: hostPlatform, claimed_tools: tools }),
  });
  if (!consume.ok || (await consume.json()).length !== 1) return json(409, { error: "pairing token was consumed concurrently" });

  const credential = await rest("smart_os_runner_credentials?on_conflict=runner_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      enrollment_id: enrollmentId,
      runner_id: enrollment.runner_id,
      credential_hash: credentialHash,
      issued_at: now,
      expires_at: credentialExpiresAt,
      revoked_at: null,
      public_publish_authorized: false,
      store_upload_authorized: false,
    }),
  });
  if (!credential.ok) return json(500, { error: "runner credential issuance failed" });

  const attestationParams = new URLSearchParams({ runner_id: `eq.${enrollment.runner_id}`, lane: `eq.${enrollment.lane}`, select: "attestation_id" });
  const attestationLookup = await rest(`smart_os_signing_runner_attestations?${attestationParams}`);
  const existing = attestationLookup.ok ? (await attestationLookup.json())[0] : null;
  const state = missingSecretRefs.length ? "blocked" : "available";
  const attestationPayload = {
    project_id: enrollment.project_id,
    runner_id: enrollment.runner_id,
    lane: enrollment.lane,
    host_platform: hostPlatform,
    tools,
    provider_handle_id: enrollment.provider_handle_id,
    state,
    blocker_category: missingSecretRefs.length ? "credentials" : null,
    blocker_message: missingSecretRefs.length ? "required signing secret references are not all present on runner" : null,
    workspace_only: true,
    public_publish_authorized: false,
    store_upload_authorized: false,
    attested_at: now,
    expires_at: credentialExpiresAt,
    last_heartbeat_at: now,
    enrollment_id: enrollmentId,
  };
  if (existing?.attestation_id) {
    await rest(`smart_os_signing_runner_attestations?attestation_id=eq.${encodeURIComponent(existing.attestation_id)}`, { method: "PATCH", body: JSON.stringify(attestationPayload) });
  } else {
    await rest("smart_os_signing_runner_attestations", { method: "POST", body: JSON.stringify({ attestation_id: `self-hosted-${enrollment.runner_id}-${Date.now()}`, ...attestationPayload }) });
  }
  await rest(`smart_os_signing_provider_handles?handle_id=eq.${encodeURIComponent(enrollment.provider_handle_id)}`, {
    method: "PATCH",
    body: JSON.stringify({ verification: missingSecretRefs.length ? "unverified" : "verified", updated_at: now }),
  });

  return json(200, {
    runnerId: enrollment.runner_id,
    lane: enrollment.lane,
    runnerToken,
    credentialExpiresAt,
    heartbeatRequired: true,
    readyForSigning: missingSecretRefs.length === 0,
    missingSecretRefs,
    secretValuesReceived: false,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  });
}

async function heartbeat(req: Request, body: any) {
  const runnerId = String(body.runnerId ?? "");
  const token = req.headers.get("x-smartos-runner-token") ?? "";
  const tools = Array.isArray(body.tools) ? [...new Set(body.tools.map(String))] : [];
  const availableSecretRefs = Array.isArray(body.availableSecretRefs) ? [...new Set(body.availableSecretRefs.map(String))] : [];
  if (!SAFE_ID.test(runnerId) || token.length < 32) return json(401, { error: "runner credential required" });
  const credentialHash = await sha256(token);
  const now = new Date().toISOString();
  const params = new URLSearchParams({ runner_id: `eq.${runnerId}`, credential_hash: `eq.${credentialHash}`, revoked_at: "is.null", expires_at: `gt.${now}`, select: "credential_id,enrollment_id,expires_at" });
  const lookup = await rest(`smart_os_runner_credentials?${params}`);
  if (!lookup.ok || !(await lookup.json())[0]) return json(401, { error: "runner credential invalid or expired" });

  const attParams = new URLSearchParams({ runner_id: `eq.${runnerId}`, select: "attestation_id,lane,provider_handle_id,host_platform" });
  const attLookup = await rest(`smart_os_signing_runner_attestations?${attParams}`);
  if (!attLookup.ok) return json(500, { error: "runner attestation lookup failed" });
  const att = (await attLookup.json())[0];
  if (!att) return json(409, { error: "runner attestation missing" });
  if (!toolSatisfied(att.lane, tools)) return json(409, { error: "runner toolchain no longer satisfies lane" });
  const p = await provider(att.provider_handle_id);
  const requiredRefs = Array.isArray(p?.required_secret_refs) ? p.required_secret_refs.map(String) : [];
  const available = new Set(availableSecretRefs);
  const missingSecretRefs = requiredRefs.filter((name: string) => !available.has(name));
  const ready = missingSecretRefs.length === 0;

  await rest(`smart_os_signing_runner_attestations?attestation_id=eq.${encodeURIComponent(att.attestation_id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      tools,
      state: ready ? "available" : "blocked",
      blocker_category: ready ? null : "credentials",
      blocker_message: ready ? null : "required signing secret references are not all present on runner",
      last_heartbeat_at: now,
      attested_at: now,
    }),
  });
  if (p) await rest(`smart_os_signing_provider_handles?handle_id=eq.${encodeURIComponent(att.provider_handle_id)}`, { method: "PATCH", body: JSON.stringify({ verification: ready ? "verified" : "unverified", updated_at: now }) });

  return json(200, {
    runnerId,
    lane: att.lane,
    readyForSigning: ready,
    missingSecretRefs,
    lastHeartbeatAt: now,
    publicPublishAuthorized: false,
    storeUploadAuthorized: false,
  });
}

async function status(req: Request) {
  const user = await getUser(req);
  if (!user) return json(401, { error: "authenticated SMART OS user required" });
  const enrollmentParams = new URLSearchParams({ requested_by: `eq.${user.id}`, select: "enrollment_id,project_id,runner_id,lane,provider_handle_id,state,requested_at,expires_at,consumed_at" });
  const enrollmentsResponse = await rest(`smart_os_runner_enrollments?${enrollmentParams}`);
  if (!enrollmentsResponse.ok) return json(500, { error: "runner status lookup failed" });
  const enrollments = await enrollmentsResponse.json();
  const ids = enrollments.map((row: any) => row.enrollment_id);
  let attestations: any[] = [];
  if (ids.length) {
    const filter = `in.(${ids.join(",")})`;
    const attResponse = await rest(`smart_os_signing_runner_attestations?enrollment_id=${encodeURIComponent(filter)}&select=attestation_id,runner_id,lane,host_platform,tools,provider_handle_id,state,blocker_category,blocker_message,attested_at,expires_at,last_heartbeat_at,public_publish_authorized,store_upload_authorized`);
    if (attResponse.ok) attestations = await attResponse.json();
  }
  return json(200, { enrollments, attestations, secretValuesIncluded: false, publicPublishAuthorized: false, storeUploadAuthorized: false });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_KEY) return json(503, { error: "runner gateway environment is incomplete" });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action ?? (req.method === "GET" ? "status" : ""));
    if (action === "create-enrollment") return await createEnrollment(req, body);
    if (action === "claim") return await claimEnrollment(body);
    if (action === "heartbeat") return await heartbeat(req, body);
    if (action === "status") return await status(req);
    return json(400, { error: "unsupported runner action" });
  } catch (error) {
    console.error("smart-os-runner error", error instanceof Error ? error.message : "unknown");
    return json(500, { error: "runner gateway internal error" });
  }
});
