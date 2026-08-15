update public.smart_os_signing_provider_handles
set required_secret_refs='["APPLE_DEVELOPMENT_TEAM_ID","APPLE_SIGNING_CERTIFICATE","APPLE_SIGNING_CERTIFICATE_PASSWORD","APPLE_PROVISIONING_PROFILE"]'::jsonb,
    verification=case when verification='verified' then 'unverified' else verification end,
    updated_at=now()
where lane='ios';
