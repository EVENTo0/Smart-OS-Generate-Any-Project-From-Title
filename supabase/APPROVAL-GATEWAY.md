# SMART OS — Supabase Approval Gateway

This package is for the dedicated SMART OS Supabase project only.

## Current deployment

- Project: `Smart OS`
- Project ref: `vzfltlqmkvrlhuppeqmy`
- Region: `ap-northeast-2`
- Status verified during Gate 22: `ACTIVE_HEALTHY`
- Project lookup initially did not appear in account listing, but direct lookup by the user-provided project ref succeeded and was used for all subsequent writes.
- Applied migrations:
  - `smart_os_approval_gateway`
  - `smart_os_approval_gateway_hardening`
- Edge Function: `smart-os-approval`
- Edge Function deployment: version 2, `ACTIVE`, `verify_jwt=true`
- Security Advisor after hardening: no findings
- Performance Advisor: only expected `unused_index` INFO notices on the new empty tables; FK coverage findings were resolved
- Auth users at first deployment verification: 0

## Components

- `sql/approval-gateway.sql` — approval request/challenge tables, RLS, grants, explicit deny policy and FK-supporting indexes.
- `functions/smart-os-approval/index.ts` — authenticated Edge Function for capability, challenge and approve/reject decisions.
- `../control-app/supabase-config.js` — public-only browser configuration (project URL + publishable key); no secret/service key.
- `../control-app/index.html` + `app.js` — phone Auth UI and authenticated approval controls.

## Security model

1. The browser signs in with Supabase Auth and sends its user JWT in `Authorization`.
2. The Edge Function is deployed with platform JWT verification enabled.
3. Approval requests are created only by an authorized server/runner using a server-side secret key. The browser cannot insert or mutate them directly.
4. `smart_os_approval_requests` is readable only by the assigned `approver_user_id` through RLS.
5. `smart_os_approval_challenges` has no direct browser grant and an explicit authenticated deny policy. Challenge creation/consume is server-side only.
6. A challenge is one-time: consumption uses one conditional Postgres UPDATE (`consumed_at IS NULL` and `expires_at > now`).
7. Final request update also requires `status = pending`, matching user/fingerprint and unexpired request.
8. Approval authorizes the exact fingerprint only. It does not authorize TestFlight, Play Console or production publication.
9. No Supabase secret/service key belongs in `control-app`, snapshots, artifacts or Git.
10. The Edge Function supports current named Supabase key environments (`SUPABASE_PUBLISHABLE_KEYS` / `SUPABASE_SECRET_KEYS`) and retains legacy single-key fallbacks.
11. The browser exposes Approve/Reject only after a real Supabase session and an authenticated capability check from the Edge Function.
12. Passwords are sent only through Supabase Auth APIs and are not written by SMART OS to snapshots, artifacts, Git, or custom browser storage.

## Gate 22 status

Backend deployment is complete. The remaining verification dependency is the first intended approver identity.

Completed:

1. Verify dedicated project identity/status.
2. Apply approval schema migration only to the dedicated SMART OS project.
3. Verify tables/RLS/grants.
4. Apply hardening migration for explicit challenge deny + FK indexes.
5. Deploy `smart-os-approval` with `verify_jwt=true`.
6. Re-check current Supabase Auth/Edge authorization guidance.
7. Update the Edge Function for current named publishable/secret key environments.
8. Redeploy Edge Function version 2.
9. Run Security Advisor and resolve findings.
10. Run Performance Advisor and resolve missing FK-index findings.
11. Wire the mobile PWA to the dedicated project using only its publishable key.
12. Add Sign up / Sign in / Sign out UI.
13. Gate Approve/Reject controls behind authenticated capability verification.

Remaining end-to-end verification:

1. Create/authenticate the intended SMART OS approver user.
2. Record the approver UUID in each release approval request; do not use user-editable metadata for authorization.
3. Insert one technically-ready release approval request from an authorized server/runner.
4. Test authenticated GET capability.
5. Test `challenge` then `decide`.
6. Confirm replay is rejected.
7. Verify a second decision cannot change an already-decided request.
8. Verify the scoped RC update remains separate from publish authorization.

## Edge Function request shapes

### Capability

Authenticated `GET /functions/v1/smart-os-approval`.

### Challenge

```json
{
  "action": "challenge",
  "requestId": "<uuid>",
  "fingerprint": "sha256:<64-hex>"
}
```

### Decision

```json
{
  "action": "decide",
  "requestId": "<uuid>",
  "fingerprint": "sha256:<64-hex>",
  "challengeId": "<uuid>",
  "decision": "approve"
}
```

`decision` may be `approve` or `reject`.

## Source/version notes

The Edge Function pins `@supabase/supabase-js@2.111.0`. Current Supabase authorization guidance was re-checked during deployment: user JWTs belong in `Authorization`, publishable keys belong in `apikey`, and `verify_jwt=true` remains appropriate for user-authenticated Edge Functions.
