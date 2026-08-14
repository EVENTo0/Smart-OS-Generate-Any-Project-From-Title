# SMART OS — Supabase Approval Gateway

Dedicated backend: `Smart OS` (`vzfltlqmkvrlhuppeqmy`).

## Components

- `sql/approval-gateway.sql` — approval request/challenge tables, RLS, grants and indexes.
- `functions/smart-os-approval/index.ts` — authenticated Edge Function for capability, scoped request discovery, challenge and approve/reject decisions.
- `control-app/live-approval.js` — authenticated mobile bridge that consumes only the safe request projection returned by the gateway.

## Deployed state

- Project region: `ap-northeast-2`
- Project status verified: `ACTIVE_HEALTHY`
- migrations applied:
  - `smart_os_approval_gateway`
  - `smart_os_approval_gateway_hardening`
  - `smart_os_first_approval_request_bootstrap`
- Edge Function: `smart-os-approval` v3, `ACTIVE`, `verify_jwt=true`
- First real approver Auth user exists and is email-confirmed.
- First real scoped Snake Web approval request has been issued against the exact release-candidate fingerprint and local-runner evidence.

## Security model

1. The browser signs in with Supabase Auth and sends its user JWT in `Authorization`.
2. The Edge Function is deployed with JWT verification enabled.
3. Approval requests are created only by an authorized server/runner/bootstrap operation. The browser cannot insert or mutate them directly.
4. `smart_os_approval_requests` is readable only by the assigned `approver_user_id` through RLS.
5. `smart_os_approval_challenges` has an explicit deny policy for authenticated browser users and no direct browser grant.
6. A challenge is one-time: consumption uses one conditional Postgres UPDATE (`consumed_at IS NULL` and `expires_at > now`).
7. Final request update also requires `status = pending`, matching user/fingerprint and unexpired request.
8. Approval authorizes the exact candidate fingerprint only. It does not authorize TestFlight, Play Console or production publication.
9. No Supabase secret/service key belongs in `control-app`, snapshots, artifacts or Git.
10. Gateway GET returns only a safe request projection for the authenticated user: no secret, proof, raw evidence or release credential.

## Mobile flow

1. Sign in to the isolated SMART OS Supabase project.
2. Gateway GET verifies the session and returns the newest unexpired pending request assigned to the authenticated user.
3. The PWA renders only the safe request projection and exact candidate fingerprint.
4. Approve/Reject requests a short-lived challenge.
5. The decision consumes the challenge atomically and updates the exact pending request.
6. A successful decision always returns `publicPublishAuthorized=false`.
7. Store/TestFlight/production publication remains a separate explicit gate.

## Security advisor status

Database/RLS hardening is clean. Supabase Security Advisor currently reports one Auth-level warning: **Leaked Password Protection Disabled**. Enable it under the project's Auth password-security settings before treating phone approval as hardened for sensitive release operations. Also use a new unique approver password after bootstrap rather than retaining a password that has been shared outside the Auth client.

Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Final Gate 22 verification still required

- authenticate the real approver from the phone/preview client;
- confirm Gateway GET returns the exact pending request;
- execute challenge → approve or reject;
- verify challenge `consumed_at` is populated;
- verify the request status/actor/verifier fields are updated;
- verify a second decision cannot mutate the already-decided request;
- then close Gate 22.
