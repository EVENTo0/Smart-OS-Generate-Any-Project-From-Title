# SMART OS — Supabase Approval Gateway

This package is for the dedicated SMART OS Supabase project only.

## Components

- `sql/approval-gateway.sql` — approval request/challenge tables, RLS, grants and indexes.
- `functions/smart-os-approval/index.ts` — authenticated Edge Function for capability, challenge and approve/reject decisions.

## Security model

1. The browser signs in with Supabase Auth and sends its user JWT in `Authorization`.
2. The Edge Function must be deployed with JWT verification enabled.
3. Approval requests are created only by an authorized server/runner using a server-side secret key. The browser cannot insert or mutate them directly.
4. `smart_os_approval_requests` is readable only by the assigned `approver_user_id` through RLS.
5. `smart_os_approval_challenges` has no direct browser grant. Challenge creation/consume is server-side only.
6. A challenge is one-time: consumption uses one conditional Postgres UPDATE (`consumed_at IS NULL` and `expires_at > now`).
7. Final request update also requires `status = pending`, matching user/fingerprint and unexpired request.
8. Approval authorizes the exact fingerprint only. It does not authorize TestFlight, Play Console or production publication.
9. No Supabase secret/service key belongs in `control-app`, snapshots, artifacts or Git.

## Deployment sequence

When the dedicated SMART OS project ref is visible to the connected Supabase tool:

1. Inspect project status and existing functions/tables.
2. Apply `sql/approval-gateway.sql` only to that project.
3. Verify tables/RLS/grants.
4. Deploy `smart-os-approval` with `verify_jwt=true`.
5. Run Supabase security advisors and fix any findings.
6. Create/authenticate the intended SMART OS approver user.
7. Store the approver UUID in each release approval request; do not use user-editable metadata for authorization.
8. Insert one technically-ready release approval request from an authorized server/runner.
9. Test authenticated GET capability.
10. Test `challenge` then `decide`, then confirm replay is rejected.
11. Verify a second decision cannot change an already-decided request.
12. Only after those checks enable the mobile PWA authenticated approval controls.

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

The Edge Function pins `@supabase/supabase-js@2.111.0`. Review current Supabase changelog/security guidance before upgrading the pinned version.
