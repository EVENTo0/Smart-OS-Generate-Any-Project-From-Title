create table if not exists public.smart_os_runner_enrollments (
  enrollment_id uuid primary key default gen_random_uuid(),
  project_id text not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  runner_id text not null,
  lane text not null check (lane in ('android','ios')),
  provider_handle_id text not null references public.smart_os_signing_provider_handles(handle_id) on delete restrict,
  pairing_hash text not null check (pairing_hash ~ '^sha256:[0-9a-f]{64}$'),
  state text not null default 'pending' check (state in ('pending','consumed','revoked','expired')),
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  claimed_host_platform text check (claimed_host_platform is null or claimed_host_platform in ('linux','macos','windows')),
  claimed_tools jsonb not null default '[]'::jsonb check (jsonb_typeof(claimed_tools)='array'),
  public_publish_authorized boolean not null default false check (public_publish_authorized=false),
  store_upload_authorized boolean not null default false check (store_upload_authorized=false)
);

create table if not exists public.smart_os_runner_credentials (
  credential_id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique references public.smart_os_runner_enrollments(enrollment_id) on delete cascade,
  runner_id text not null unique,
  credential_hash text not null check (credential_hash ~ '^sha256:[0-9a-f]{64}$'),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  public_publish_authorized boolean not null default false check (public_publish_authorized=false),
  store_upload_authorized boolean not null default false check (store_upload_authorized=false)
);

alter table public.smart_os_signing_runner_attestations
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists enrollment_id uuid references public.smart_os_runner_enrollments(enrollment_id) on delete set null;

create index if not exists smart_os_runner_enrollments_requested_by_idx on public.smart_os_runner_enrollments(requested_by);
create index if not exists smart_os_runner_enrollments_state_expires_idx on public.smart_os_runner_enrollments(state, expires_at);
create index if not exists smart_os_runner_credentials_runner_id_idx on public.smart_os_runner_credentials(runner_id);
create index if not exists smart_os_signing_runner_attestations_heartbeat_idx on public.smart_os_signing_runner_attestations(last_heartbeat_at);

alter table public.smart_os_runner_enrollments enable row level security;
alter table public.smart_os_runner_credentials enable row level security;

create policy "runner enrollments deny browser reads" on public.smart_os_runner_enrollments for select to authenticated using (false);
create policy "runner enrollments deny browser writes" on public.smart_os_runner_enrollments for all to authenticated using (false) with check (false);
create policy "runner credentials deny browser reads" on public.smart_os_runner_credentials for select to authenticated using (false);
create policy "runner credentials deny browser writes" on public.smart_os_runner_credentials for all to authenticated using (false) with check (false);
