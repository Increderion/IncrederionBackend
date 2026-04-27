export type CompanyRow = {
  id: string;
  name: string;
  nip: string | null;
  krs: string | null;
  regon: string | null;
  legal_form: string | null;
  industry: string | null;
  registration_date: string | null;
  president_name: string | null;
  registry_source_url: string | null;
  registry_raw_markdown: string | null;
  registry_raw_metadata: Record<string, unknown> | null;
  registry_sync_status: string;
  last_registry_sync_at: string | null;
  registry_sync_error: string | null;
  created_at: string;
  updated_at: string;
};
