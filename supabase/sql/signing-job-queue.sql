create table if not exists public.smart_os_signing_jobs (
  job_id uuid primary key default gen_random_uuid(),
  release_candidate_id uuid not null references public.smart_os_release_candidates(release_candidate_id) on delete restrict,
  project_id text not null,
  version text not null,
  candidate_fingerprint text not null check (candidate_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  lane text not null check (lane in ('android','ios')),
  runner_id text not null,
  provider_handle_id text not null references public.smart_os_signing_provider_handles(handle_id) on delete restrict,
  command jsonb not null check (jsonb_typeof(command)='object'),
  output_path text not null,
  secret_refs jsonb not null check (jsonb_typeof(secret_refs)='array'),
  status text not null default 'queued' check (status in ('queued','leased','succeeded','failed','cancelled')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  leased_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  artifact_sha256 text check (artifact_sha256 is null or artifact_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  artifact_size_bytes bigint check (artifact_size_bytes is null or artifact_size_bytes >= 0),
  result_summary text,
  public_publish_authorized boolean not null default false check (public_publish_authorized=false),
  store_upload_authorized boolean not null default false check (store_upload_authorized=false)
);
create unique index if not exists smart_os_signing_jobs_active_lane_idx on public.smart_os_signing_jobs(release_candidate_id,lane) where status in ('queued','leased');
create index if not exists smart_os_signing_jobs_runner_status_idx on public.smart_os_signing_jobs(runner_id,status,created_at);
alter table public.smart_os_signing_jobs enable row level security;
create policy "signing jobs deny browser reads" on public.smart_os_signing_jobs for select to authenticated using (false);
create policy "signing jobs deny browser writes" on public.smart_os_signing_jobs for all to authenticated using (false) with check (false);
