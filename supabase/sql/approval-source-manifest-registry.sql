create table if not exists public.smart_os_approval_source_manifests (
  request_id uuid primary key references public.smart_os_approval_requests(request_id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  canonical_manifest jsonb not null check (jsonb_typeof(canonical_manifest) = 'object'),
  source_manifest_digest text not null check (source_manifest_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

alter table public.smart_os_approval_source_manifests enable row level security;
drop policy if exists "deny browser approval source manifest access" on public.smart_os_approval_source_manifests;
create policy "deny browser approval source manifest access"
on public.smart_os_approval_source_manifests
for all to anon, authenticated using (false) with check (false);

create or replace function public.smart_os_validate_approval_source_manifest()
returns trigger language plpgsql security definer set search_path = public as $$
declare req record;
begin
  select approval_schema_version, source_manifest_digest into req
  from public.smart_os_approval_requests where request_id = new.request_id;
  if not found then raise exception 'approval request not found for source manifest'; end if;
  if req.approval_schema_version <> 2 then raise exception 'source manifest registry requires approval schema v2'; end if;
  if req.source_manifest_digest is distinct from new.source_manifest_digest then
    raise exception 'approval source manifest digest does not match request';
  end if;
  return new;
end;
$$;

drop trigger if exists smart_os_approval_source_manifest_guard on public.smart_os_approval_source_manifests;
create trigger smart_os_approval_source_manifest_guard
before insert or update of request_id,source_manifest_digest
on public.smart_os_approval_source_manifests
for each row execute function public.smart_os_validate_approval_source_manifest();

revoke all on function public.smart_os_validate_approval_source_manifest() from public, anon, authenticated;
