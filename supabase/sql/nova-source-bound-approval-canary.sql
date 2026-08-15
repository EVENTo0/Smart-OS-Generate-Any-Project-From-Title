-- Source-bound approval v2 canary for the already validated NOVA web preview.
-- This does not authorize production or store publication.
with approver as (
  select approver_user_id
  from public.smart_os_approval_requests
  where status = 'approved'
    and decided_by = approver_user_id
    and verifier_id = 'supabase-auth-edge'
  order by decided_at desc nulls last
  limit 1
), created as (
  insert into public.smart_os_approval_requests (
    request_id, project_id, fingerprint, target_lanes, artifact_ids, evidence_refs,
    approver_user_id, requested_at, expires_at, status,
    approval_schema_version, source_manifest_digest
  )
  select
    gen_random_uuid(),
    'nova-service-hub',
    'sha256:fe2f2e77bfcac6b7b74ed6221e53ec8554ce4b4d650b826f213f5a97f1d1171b',
    '["web"]'::jsonb,
    '["nova-web-preview-manifest","nova-live-validation-report"]'::jsonb,
    '["git:blob:control-app/demos/nova-service-hub/index.html:49ffd83c076677aa3d3dd63c3a6de2438019c50a","git:blob:examples/nova-service-hub/live-validation.json:86a0d17d5ba0d4a3ddc50c04a113867579b8bb7e","vercel:dpl_BNvqHUZv2C5CX8oghoJQ5H1PUZj2:/demos/nova-service-hub/:http-200"]'::jsonb,
    approver.approver_user_id,
    now(), now() + interval '4 hours', 'pending', 2,
    'sha256:3357d571b9ffd41aad63a79e75e8ca6f11c548bf9e86138b4c94c3536095a8c4'
  from approver
  returning request_id
)
insert into public.smart_os_approval_source_manifests (
  request_id, schema_version, canonical_manifest, source_manifest_digest
)
select
  request_id, 1,
  jsonb_build_object(
    'schemaVersion', '1',
    'lanes', jsonb_build_array(
      jsonb_build_object(
        'lane', 'web',
        'sourceKind', 'git-object',
        'sourceCommitSha', '13d6883925b737e04d85960356575271f669b42a',
        'sourceObjectPath', 'control-app/demos/nova-service-hub/index.html',
        'sourceObjectSha', '49ffd83c076677aa3d3dd63c3a6de2438019c50a',
        'materializerId', 'universal-product-web-mobile-v1'
      )
    )
  ),
  'sha256:3357d571b9ffd41aad63a79e75e8ca6f11c548bf9e86138b4c94c3536095a8c4'
from created;
