create table if not exists public.smart_os_release_candidates (
  release_candidate_id uuid primary key default gen_random_uuid(),
  project_id text not null,
  version text not null,
  candidate_fingerprint text not null check (candidate_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  approval_request_id uuid not null references public.smart_os_approval_requests(request_id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  verifier_id text not null,
  approved_at timestamptz not null,
  promoted_at timestamptz not null default now(),
  target_lanes jsonb not null default '[]'::jsonb,
  artifact_ids jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  status text not null default 'promoted' check (status in ('promoted','packaging','packaged','blocked')),
  public_publish_authorized boolean not null default false check (public_publish_authorized = false),
  unique (project_id, version),
  unique (candidate_fingerprint, version)
);

alter table public.smart_os_release_candidates enable row level security;

create policy "approver_can_read_own_release_candidates"
on public.smart_os_release_candidates
for select
to authenticated
using (approved_by = auth.uid());

create index if not exists smart_os_release_candidates_approval_request_idx
  on public.smart_os_release_candidates(approval_request_id);
create index if not exists smart_os_release_candidates_approved_by_idx
  on public.smart_os_release_candidates(approved_by);

-- Release-candidate rows are inserted by a trusted backend only after a verified
-- approval decision. Static/mobile clients have read-only RLS access and never
-- receive a policy that allows promotion or public publication.
