alter table public.smart_os_approval_requests
  add column if not exists approval_schema_version smallint not null default 1,
  add column if not exists source_manifest_digest text;

alter table public.smart_os_release_candidates
  add column if not exists approval_schema_version smallint not null default 1,
  add column if not exists source_manifest_digest text;

alter table public.smart_os_release_candidate_lane_provenance
  add column if not exists source_manifest_digest text;

alter table public.smart_os_signing_jobs
  add column if not exists source_manifest_digest text;

alter table public.smart_os_approval_requests
  drop constraint if exists smart_os_approval_requests_source_manifest_v2_check;
alter table public.smart_os_approval_requests
  add constraint smart_os_approval_requests_source_manifest_v2_check check (
    (approval_schema_version = 1 and source_manifest_digest is null)
    or (approval_schema_version = 2 and source_manifest_digest ~ '^sha256:[0-9a-f]{64}$')
  );

alter table public.smart_os_release_candidates
  drop constraint if exists smart_os_release_candidates_source_manifest_v2_check;
alter table public.smart_os_release_candidates
  add constraint smart_os_release_candidates_source_manifest_v2_check check (
    (approval_schema_version = 1 and source_manifest_digest is null)
    or (approval_schema_version = 2 and source_manifest_digest ~ '^sha256:[0-9a-f]{64}$')
  );

alter table public.smart_os_release_candidate_lane_provenance
  drop constraint if exists smart_os_release_candidate_lane_provenance_source_digest_check;
alter table public.smart_os_release_candidate_lane_provenance
  add constraint smart_os_release_candidate_lane_provenance_source_digest_check check (
    source_manifest_digest is null or source_manifest_digest ~ '^sha256:[0-9a-f]{64}$'
  );

alter table public.smart_os_signing_jobs
  drop constraint if exists smart_os_signing_jobs_source_digest_check;
alter table public.smart_os_signing_jobs
  add constraint smart_os_signing_jobs_source_digest_check check (
    source_manifest_digest is null or source_manifest_digest ~ '^sha256:[0-9a-f]{64}$'
  );

create or replace function public.smart_os_validate_release_candidate_approval_chain()
returns trigger language plpgsql security definer set search_path = public as $$
declare req record;
begin
  select approval_schema_version, source_manifest_digest, fingerprint, status into req
  from public.smart_os_approval_requests where request_id = new.approval_request_id;
  if not found then raise exception 'approval request not found for release candidate'; end if;
  if req.status <> 'approved' then raise exception 'release candidate requires approved request'; end if;
  if req.fingerprint <> new.candidate_fingerprint then raise exception 'release candidate fingerprint does not match approval request'; end if;
  if req.approval_schema_version <> new.approval_schema_version
     or req.source_manifest_digest is distinct from new.source_manifest_digest then
    raise exception 'release candidate source manifest binding does not match approval request';
  end if;
  return new;
end;
$$;

drop trigger if exists smart_os_release_candidate_approval_chain_guard on public.smart_os_release_candidates;
create trigger smart_os_release_candidate_approval_chain_guard
before insert or update of approval_request_id,candidate_fingerprint,approval_schema_version,source_manifest_digest
on public.smart_os_release_candidates
for each row execute function public.smart_os_validate_release_candidate_approval_chain();

create or replace function public.smart_os_validate_lane_provenance_source_chain()
returns trigger language plpgsql security definer set search_path = public as $$
declare rc record;
begin
  select approval_schema_version, source_manifest_digest into rc
  from public.smart_os_release_candidates where release_candidate_id = new.release_candidate_id;
  if not found then raise exception 'release candidate not found for lane provenance'; end if;
  if rc.source_manifest_digest is distinct from new.source_manifest_digest then
    raise exception 'lane provenance source manifest digest mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists smart_os_lane_provenance_source_chain_guard on public.smart_os_release_candidate_lane_provenance;
create trigger smart_os_lane_provenance_source_chain_guard
before insert or update of release_candidate_id,source_manifest_digest
on public.smart_os_release_candidate_lane_provenance
for each row execute function public.smart_os_validate_lane_provenance_source_chain();

create or replace function public.smart_os_validate_signing_job_source_chain()
returns trigger language plpgsql security definer set search_path = public as $$
declare rc_digest text; prov record;
begin
  select source_manifest_digest into rc_digest
  from public.smart_os_release_candidates where release_candidate_id = new.release_candidate_id;
  if not found then raise exception 'release candidate not found for signing job'; end if;
  select release_candidate_id, lane, source_manifest_digest, source_commit_sha, generator_blob_sha, materializer_id into prov
  from public.smart_os_release_candidate_lane_provenance where provenance_id = new.source_provenance_id;
  if not found then raise exception 'lane provenance not found for signing job'; end if;
  if prov.release_candidate_id <> new.release_candidate_id or prov.lane <> new.lane then
    raise exception 'signing job lane provenance scope mismatch';
  end if;
  if rc_digest is distinct from new.source_manifest_digest
     or prov.source_manifest_digest is distinct from new.source_manifest_digest then
    raise exception 'signing job source manifest digest mismatch';
  end if;
  if prov.source_commit_sha <> new.source_commit_sha
     or prov.generator_blob_sha <> new.generator_blob_sha
     or prov.materializer_id <> new.materializer_id then
    raise exception 'signing job immutable source provenance mismatch';
  end if;
  return new;
end;
$$;

drop trigger if exists smart_os_signing_job_source_chain_guard on public.smart_os_signing_jobs;
create trigger smart_os_signing_job_source_chain_guard
before insert or update of release_candidate_id,lane,source_provenance_id,source_manifest_digest,source_commit_sha,generator_blob_sha,materializer_id
on public.smart_os_signing_jobs
for each row execute function public.smart_os_validate_signing_job_source_chain();
