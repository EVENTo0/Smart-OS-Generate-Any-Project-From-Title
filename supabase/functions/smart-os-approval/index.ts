import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  } catch {
    return "";
  }
};

const publicKey = () =>
  namedKey("SUPABASE_PUBLISHABLE_KEYS") ||
  Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";

const secretKey = () =>
  namedKey("SUPABASE_SECRET_KEYS") ||
  Deno.env.get("SUPABASE_SECRET_KEY") ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

const validFingerprint = (value: unknown): value is string =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/.test(value);

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

    if (req.method === "GET") {
      return json({
        authenticatedApproval: true,
        provider: "supabase-auth",
        oneTimeChallenge: true,
        browserHasReleaseCredentials: false,
        publicPublishAllowed: false,
      });
    }

    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

    const admin = createClient(supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.action !== "string") return json({ error: "invalid request body" }, 400);

    const requestId = typeof body.requestId === "string" ? body.requestId : "";
    const fingerprint = body.fingerprint;
    if (!requestId || !validFingerprint(fingerprint)) return json({ error: "invalid requestId or fingerprint" }, 400);

    const now = new Date();
    const nowIso = now.toISOString();

    const { data: approvalRequest, error: requestError } = await admin
      .from("smart_os_approval_requests")
      .select("request_id,project_id,fingerprint,approver_user_id,expires_at,status")
      .eq("request_id", requestId)
      .eq("fingerprint", fingerprint)
      .eq("approver_user_id", user.id)
      .eq("status", "pending")
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (requestError) return json({ error: "approval request lookup failed" }, 500);
    if (!approvalRequest) return json({ error: "approval request unavailable or expired" }, 404);

    if (body.action === "challenge") {
      const challengeId = crypto.randomUUID();
      const requestExpiryMs = Date.parse(approvalRequest.expires_at);
      const challengeExpiryMs = Math.min(requestExpiryMs, now.getTime() + 5 * 60 * 1000);
      const expiresAt = new Date(challengeExpiryMs).toISOString();

      const { error: challengeError } = await admin.from("smart_os_approval_challenges").insert({
        challenge_id: challengeId,
        request_id: requestId,
        approver_user_id: user.id,
        fingerprint,
        expires_at: expiresAt,
      });
      if (challengeError) return json({ error: "challenge creation failed" }, 500);

      return json({ challengeId, requestId, fingerprint, expiresAt });
    }

    if (body.action === "decide") {
      const challengeId = typeof body.challengeId === "string" ? body.challengeId : "";
      const decision = body.decision === "approve" || body.decision === "reject" ? body.decision : null;
      if (!challengeId || !decision) return json({ error: "invalid challengeId or decision" }, 400);

      const consumedAt = new Date().toISOString();
      const { data: consumed, error: consumeError } = await admin
        .from("smart_os_approval_challenges")
        .update({ consumed_at: consumedAt })
        .eq("challenge_id", challengeId)
        .eq("request_id", requestId)
        .eq("approver_user_id", user.id)
        .eq("fingerprint", fingerprint)
        .is("consumed_at", null)
        .gt("expires_at", consumedAt)
        .select("challenge_id")
        .maybeSingle();

      if (consumeError) return json({ error: "challenge consume failed" }, 500);
      if (!consumed) return json({ error: "challenge invalid, expired, or already used" }, 409);

      const nextStatus = decision === "approve" ? "approved" : "rejected";
      const { data: updated, error: updateError } = await admin
        .from("smart_os_approval_requests")
        .update({
          status: nextStatus,
          decided_at: consumedAt,
          decided_by: user.id,
          verifier_id: "supabase-auth-edge",
        })
        .eq("request_id", requestId)
        .eq("fingerprint", fingerprint)
        .eq("approver_user_id", user.id)
        .eq("status", "pending")
        .gt("expires_at", consumedAt)
        .select("request_id,project_id,fingerprint,status,decided_at,decided_by,verifier_id")
        .maybeSingle();

      if (updateError) return json({ error: "approval decision update failed" }, 500);
      if (!updated) return json({ error: "approval request already decided or expired" }, 409);

      return json({
        requestId: updated.request_id,
        projectId: updated.project_id,
        fingerprint: updated.fingerprint,
        decision,
        verifiedActorId: updated.decided_by,
        verifierId: updated.verifier_id,
        decidedAt: updated.decided_at,
        publicPublishAuthorized: false,
      });
    }

    return json({ error: "unsupported action" }, 400);
  } catch (error) {
    console.error("smart-os-approval gateway error", error instanceof Error ? error.message : "unknown error");
    return json({ error: "approval gateway internal error" }, 500);
  }
});
