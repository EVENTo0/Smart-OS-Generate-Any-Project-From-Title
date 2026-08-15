create table if not exists public.smart_os_release_candidate_lane_provenance (
  provenance_id uuid primary key default gen_random_uuid(),
  release_candidate_id uuid not null references public.smart_os_release_candidates(release_candidate_id) on delete cascade,
  lane text not null check (lane in ('android','ios')),
  source_commit_sha text not null check (source_commit_sha ~ '^[0-9a-f]{40}$'),
  generator_path text not null default 'src/implementation/generator.ts' check (generator_path = 'src/implementation/generator.ts'),
  generator_blob_sha text not null check (generator_blob_sha ~ '^[0-9a-f]{40}$'),
  materializer_id text not null check (materializer_id ~ '^[A-Za-z0-9._:-]+$'),
  evidence_run_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_run_ids) = 'array'),
  verification_source text not null default 'github-actions-evidence',
  verified_at timestamptz not null default now(),
  public_publish_authorized boolean not null default false check (public_publish_authorized = false),
  store_upload_authorized boolean not null default false check (store_upload_authorized = false),
  unique (release_candidate_id, lane)
);

alter table public.smart_os_release_candidate_lane_provenance enable row level security;
drop policy if exists "deny browser lane provenance access" on public.smart_os_release_candidate_lane_provenance;
create policy "deny browser lane provenance access"
on public.smart_os_release_candidate_lane_provenance
for all
to anon, authenticated
using (false)
with check (false);

alter table public.smart_os_signing_jobs
  add column if not exists source_provenance_id uuid references public.smart_os_release_candidate_lane_provenance(provenance_id) on delete restrict,
  add column if not exists source_commit_sha text check (source_commit_sha is null or source_commit_sha ~ '^[0-9a-f]{40}$'),
  add column if not exists generator_blob_sha text check (generator_blob_sha is null or generator_blob_sha ~ '^[0-9a-f]{40}$'),
  add column if not exists materializer_id text check (materializer_id is null or materializer_id ~ '^[A-Za-z0-9._:-]+$');

-- Current approved mobile RC provenance, derived from immutable GitHub Actions evidence.
insert into public.smart_os_release_candidate_lane_provenance (
  release_candidate_id, lane, source_commit_sha, generator_blob_sha, materializer_id, evidence_run_ids,
  verification_source, public_publish_authorized, store_upload_authorized
)
select release_candidate_id, 'android', '569cf6a3fea828b8688856ad3f6890c35e065c86', '1e471fcaf4aa1006cc51d7eeda842d3ef50e189e', 'snake-capacitor-v1', '[31736312519,31736849918]'::jsonb,
       'github-actions-evidence', false, false
from public.smart_os_release_candidates
where project_id='snake-game' and version='0.1.0-rc.2' and status='promoted'
on conflict (release_candidate_id, lane) do update set
  source_commit_sha=excluded.source_commit_sha,
  generator_blob_sha=excluded.generator_blob_sha,
  materializer_id=excluded.materializer_id,
  evidence_run_ids=excluded.evidence_run_ids,
  verification_source=excluded.verification_source,
  verified_at=now();

insert into public.smart_os_release_candidate_lane_provenance (
  release_candidate_id, lane, source_commit_sha, generator_blob_sha, materializer_id, evidence_run_ids,
  verification_source, public_publish_authorized, store_upload_authorized
)
select release_candidate_id, 'ios', '45735ce8dd3383a69a05524d7f46a7adb66cd116', '1e471fcaf4aa1006cc51d7eeda842d3ef50e189e', 'snake-capacitor-v1', '[31736453074]'::jsonb,
       'github-actions-evidence', false, false
from public.smart_os_release_candidates
where project_id='snake-game' and version='0.1.0-rc.2' and status='promoted'
on conflict (release_candidate_id, lane) do update set
  source_commit_sha=excluded.source_commit_sha,
  generator_blob_sha=excluded.generator_blob_sha,
  materializer_id=excluded.materializer_id,
  evidence_run_ids=excluded.evidence_run_ids,
  verification_source=excluded.verification_source,
  verified_at=now();
