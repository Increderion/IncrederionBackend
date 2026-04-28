-- Add registry sync columns to companies table for KYC background processing.
alter table public.companies
add column if not exists registry_source_url    text,
add column if not exists registry_raw_markdown text,
add column if not exists registry_raw_metadata jsonb default '{}'::jsonb,
add column if not exists registry_sync_status  text not null default 'pending', -- pending | ok | error
add column if not exists last_registry_sync_at timestamptz,
add column if not exists registry_sync_error   text;

-- Refresh PostgREST schema cache (optional helper)
-- notify pgrst, 'reload schema';
