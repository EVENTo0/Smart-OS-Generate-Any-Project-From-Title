-- SMART OS Gate 22 — isolated approval gateway schema
-- Apply only to the dedicated SMART OS Supabase project.

create table if not exists public.smart_os_approval_requests (
  request_id uuid primary key,
  project_id text not null,
  fingerprint text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  target_lanes jsonb not null default '[]'::jsonb,
  artifact_ids jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  verifier_id text,
  constraint smart_os_approval_request_window check (expires_at > requested_at)
);

create index if not exists smart_os_approval_requests_approver_status_idx
  on public.smart_os_approval_requests (approver_user_id, status, expires_at);

create table if not exists public.smart_os_approval_challenges (
  challenge_id uuid primary key,
  request_id uuid not null references public.smart_os_approval_requests(request_id) on delete cascade,
  approver_user_id uuid not null references auth.users(id) on delete cascade,
  fingerprint text not null check (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint smart_os_approval_challenge_window check (expires_at > created_at)
);

create index if not exists smart_os_approval_challenges_lookup_idx
  on public.smart_os_approval_challenges (challenge_id, request_id, approver_user_id, expires_at);

alter table public.smart_os_approval_requests enable row level security;
alter table public.smart_os_approval_challenges enable row level security;

revoke all on table public.smart_os_approval_requests from anon, authenticated;
revoke all on table public.smart_os_approval_challenges from anon, authenticated;

grant select on table public.smart_os_approval_requests to authenticated;
grant all on table public.smart_os_approval_requests to service_role;
grant all on table public.smart_os_approval_challenges to service_role;

drop policy if exists "smart_os_approver_reads_own_requests" on public.smart_os_approval_requests;
create policy "smart_os_approver_reads_own_requests"
  on public.smart_os_approval_requests
  for select
  to authenticated
  using ((select auth.uid()) = approver_user_id);

comment on table public.smart_os_approval_requests is
  'SMART OS release approval requests. Browser users may only read requests assigned to their own auth.uid().';
comment on table public.smart_os_approval_challenges is
  'Server-created one-time approval challenges. No direct authenticated table access; Edge Function/service role only.';
