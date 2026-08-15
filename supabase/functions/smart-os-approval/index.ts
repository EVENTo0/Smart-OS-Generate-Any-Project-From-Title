import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const env = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const namedKey = (setName: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS") => {
  const raw = Deno.env.get(setName);
  if (!raw) return "";
  try {
    const names = JSON.parse(raw) as Record<string, string>;
    const envName = names.default ?? Object.values(names)[0];
    return envName ? Deno.env.get(envName) ?? "" : "";
  } catch { return ""; }
};

const publicKey = () => namedKey("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
const secretKey = () => namedKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const validFingerprint = (value: unknown): value is string => typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);

function validSourceBinding(row: { approval_schema_version?: number; source_manifest_digest?: string | null }) {
  if (row.approval_schema_version === 1) return row.source_manifest_digest == null;
  if (row.approval_schema_version === 2) return validFingerprint(row.source_manifest_digest);
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "authentication required" }, 401);

    const supabaseUrl = env("SUPABASE_URL");
    const publishable = publicKey();
    const secret = secretKey();
    if (!publishable || !secret) return json({ error: "approval gateway is not configured" }, 503);

    const userClient = createClient(supabaseUrl, publishable, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "invalid authenticated session" }, 401);
    const user = userData.user;

    const admin = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    const now = new Date();
    const nowIso = now.toISOString();

    if (req.method === "GET") {
      const { data: pending, error: pendingError } = await admin
        .from("smart_os_approval_requests")
        .select("request_id,project_id,fingerprint,target_lanes,artifact_ids,evidence_refs,requested_at,expires_at,status,approval_schema_version,source_manifest_digest")
        .eq("approver_user_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", nowIso)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingError) return json({ error: "approval request lookup failed" }, 500);
      if (pending && !validSourceBinding(pending)) return json({ error: "approval request source binding is invalid" }, 409);

      const approvalRequest = pending ? {
        schemaVersion: String(pending.approval_schema_version ?? 1),
        requestId: pending.request_id,
        projectId: pending.project_id,
        candidateFingerprint: pending.fingerprint,
        targetLanes: Array.isArray(pending.target_lanes) ? pending.target_lanes : [],
        artifactCount: Array.isArray(pending.artifact_ids) ? pending.artifact_ids.length : 0,
        evidenceCount: Array.isArray(pending.evidence_refs) ? pending.evidence_refs.length : 0,
        sourceBound: pending.approval_schema_version === 2,
        requestedAt: pending.requested_at,
        expiresAt: pending.expires_at,
        browserCanSelfApprove: false,
        containsVerifierCredential: false,
        containsOpaqueProof: false,
      } : null;

      return json({ authenticatedApproval: true, provider: "supabase-auth", oneTimeChallenge: true, browserHasReleaseCredentials: false, publicPublishAllowed: false, approvalRequest });
    }

    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") return json({ error: "invalid request body" }, 400);
    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const fingerprint = body.fingerprint;
    if (!requestId || !validFingerprint(fingerprint)) return json({ error: "invalid requestId or fingerprint" }, 400);

    const { data: approvalRequest, error: requestError } = await admin
      .from("smart_os_approval_requests")
      .select("request_id,project_id,fingerprint,approver_user_id,expires_at,status,approval_schema_version,source_manifest_digest")
      .eq("request_id", requestId)
      .eq("fingerprint", fingerprint)
      .eq("approver_user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .maybeSingle();
    if (requestError) return json({ error: "approval request lookup failed" }, 500);
    if (!approvalRequest) return json({ error: "approval request unavailable or expired" }, 404);
    if (!validSourceBinding(approvalRequest)) return json({ error: "approval request source binding is invalid" }, 409);

    if (body.action === "challenge") {
      const challengeId = crypto.randomUUID();
      const challengeExpiryMs = Math.min(Date.parse(approvalRequest.expires_at), now.getTime() + 5 * 60 * 1000);
      const expiresAt = new Date(challengeExpiryMs).toISOString();
      const { error: challengeError } = await admin.from("smart_os_approval_challenges").insert({ challenge_id: challengeId, request_id: requestId, approver_user_id: user.id, fingerprint, expires_at: expiresAt });
      if (challengeError) return json({ error: "challenge creation failed" }, 500);
      return json({ challengeId, requestId, fingerprint, expiresAt, sourceBound: approvalRequest.approval_schema_version === 2 });
    }

    if (body.action === "decide") {
      const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
      if (!challengeId || !decision) return json({ error: "invalid challengeId or decision" }, 400);
      const consumedAt = new Date().toISOString();
      const { data: consumed, error: consumeError } = await admin
        .from("smart_os_approval_challenges")
        .update({ consumed_at: consumedAt })
        .eq("challenge_id", challengeId).eq("request_id", requestId).eq("approver_user_id", user.id).eq("fingerprint", fingerprint)
        .is("consumed_at", null).gt("expires_at", consumedAt).select("challenge_id").maybeSingle();
      if (consumeError) return json({ error: "challenge consume failed" }, 500);
      if (!consumed) return json({ error: "challenge invalid, expired, or already used" }, 409);

      const nextStatus = decision === "approve" ? "approved" : "rejected";
      const { data: updated, error: updateError } = await admin
        .from("smart_os_approval_requests")
        .update({ status: nextStatus, decided_at: consumedAt, decided_by: user.id, verifier_id: "supabase-auth-edge" })
        .eq("request_id", requestId).eq("fingerprint", fingerprint).eq("approver_user_id", user.id).eq("status", "pending").gt("expires_at", consumedAt)
        .select("request_id,project_id,fingerprint,status,decided_at,decided_by,verifier_id,approval_schema_version")
        .maybeSingle();
      if (updateError) return json({ error: "approval decision update failed" }, 500);
      if (!updated) return json({ error: "approval request already decided or expired" }, 409);

      return json({ requestId: updated.request_id, projectId: updated.project_id, fingerprint: updated.fingerprint, decision, verifiedActorId: updated.decided_by, verifierId: updated.verifier_id, decidedAt: updated.decided_at, sourceBound: updated.approval_schema_version === 2, publicPublishAuthorized: false });
    }
    return json({ error: "unsupported action" }, 400);
  } catch (error) {
    console.error("smart-os-approval gateway error", error instanceof Error ? error.message : "unknown error");
    return json({ error: "approval gateway internal error" }, 500);
  }
});
