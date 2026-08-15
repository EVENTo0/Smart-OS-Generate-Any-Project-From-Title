-- Promote the latest authenticated NOVA source-bound approval to a Web RC.
-- No production publication is authorized.
with approved as (
  select request_id, project_id, fingerprint, target_lanes, artifact_ids, evidence_refs,
         decided_by, verifier_id, decided_at, approval_schema_version, source_manifest_digest
  from public.smart_os_approval_requests
  where project_id='nova-service-hub'
    and approval_schema_version=2
    and status='approved'
    and decided_by=approver_user_id
    and verifier_id='supabase-auth-edge'
  order by decided_at desc nulls last
  limit 1
)
insert into public.smart_os_release_candidates (
  project_id, version, candidate_fingerprint, approval_request_id, approved_by, verifier_id,
  approved_at, promoted_at, target_lanes, artifact_ids, evidence_refs, status,
  public_publish_authorized, approval_schema_version, source_manifest_digest
)
select project_id, '0.1.0-rc.1', fingerprint, request_id, decided_by, verifier_id,
       decided_at, now(), target_lanes, artifact_ids, evidence_refs, 'promoted',
       false, approval_schema_version, source_manifest_digest
from approved
where not exists (
  select 1 from public.smart_os_release_candidates
  where project_id='nova-service-hub' and version='0.1.0-rc.1'
);
