-- KYC/AML Schema v2
-- Drops old 'reports' (simple link table) and recreates as full KYC report entity.
-- Adds report_findings (findings carousel) and company_persons (management cross-ref).

-- ─────────────────────────────────────────────────────────────
-- 0. Drop old reports table (was just a company_id+user_id link)
-- ─────────────────────────────────────────────────────────────
drop table if exists public.reports cascade;

-- ─────────────────────────────────────────────────────────────
-- 1. REPORTS  (history of KYC reports per user)
-- ─────────────────────────────────────────────────────────────
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  company_id  uuid not null references public.companies(id) on delete cascade,
  -- pipeline status
  status      text not null default 'pending',  -- pending | running | completed | failed
  error       text,                              -- last pipeline error message
  -- scoring (filled after pipeline completes)
  risk_score  int check (risk_score between 0 and 100),
  -- AI hook (filled by colleague's AI module)
  ai_summary  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_reports_user_id    on public.reports(user_id);
create index idx_reports_company_id on public.reports(company_id);
create index idx_reports_status     on public.reports(status);
create index idx_reports_created_at on public.reports(created_at desc);

drop trigger if exists trg_reports_set_updated_at on public.reports;
create trigger trg_reports_set_updated_at
before update on public.reports
for each row
execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. REPORT_FINDINGS  (individual findings = carousel items)
-- ─────────────────────────────────────────────────────────────
create table public.report_findings (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references public.reports(id) on delete cascade,
  company_id   uuid not null references public.companies(id) on delete cascade,
  -- classification
  category     text not null,               -- registry | opinion | news | management
  severity     text not null default 'info', -- info | low | medium | high | critical
  -- content
  title        text not null,
  summary      text,                         -- short extract shown in carousel card
  url          text,
  source       text,                         -- e.g. "trustpilot.com", "pap.pl", "rejestr.io"
  published_at timestamptz,
  -- raw scrape (for AI processing later)
  raw_markdown text,
  created_at   timestamptz not null default now()
);

create index idx_findings_report_id  on public.report_findings(report_id);
create index idx_findings_company_id on public.report_findings(company_id);
create index idx_findings_category   on public.report_findings(category);
create index idx_findings_severity   on public.report_findings(severity);

-- ─────────────────────────────────────────────────────────────
-- 3. COMPANY_PERSONS  (management / shareholders cross-ref)
-- ─────────────────────────────────────────────────────────────
create table public.company_persons (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  full_name        text not null,
  role             text,   -- "Prezes Zarządu" | "Wspólnik" | "Prokurent" etc.
  -- cross-reference: other companies this person appears in (denormalized for MVP)
  other_companies  jsonb default '[]'::jsonb,
  -- [{ "name": "...", "krs": "...", "nip": "...", "role": "..." }]
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_persons_company_id on public.company_persons(company_id);
create index idx_persons_full_name  on public.company_persons(full_name);

drop trigger if exists trg_persons_set_updated_at on public.company_persons;
create trigger trg_persons_set_updated_at
before update on public.company_persons
for each row
execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────
alter table public.reports         enable row level security;
alter table public.report_findings enable row level security;
alter table public.company_persons enable row level security;

-- Reports: users see and manage only their own
drop policy if exists "reports_select_own"  on public.reports;
create policy "reports_select_own"
on public.reports for select
using (user_id = auth.uid());

drop policy if exists "reports_insert_own"  on public.reports;
create policy "reports_insert_own"
on public.reports for insert
with check (user_id = auth.uid());

drop policy if exists "reports_update_own"  on public.reports;
create policy "reports_update_own"
on public.reports for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "reports_delete_own"  on public.reports;
create policy "reports_delete_own"
on public.reports for delete
using (user_id = auth.uid());

-- Findings: visible through their parent report (user_id check via join)
-- Use service-role on backend for inserts; frontend reads via user's report ownership.
drop policy if exists "findings_select_authenticated" on public.report_findings;
create policy "findings_select_authenticated"
on public.report_findings for select
using (
  exists (
    select 1 from public.reports r
    where r.id = report_findings.report_id
      and r.user_id = auth.uid()
  )
);

-- Company persons: public registry data, readable for all authenticated users
drop policy if exists "persons_select_authenticated" on public.company_persons;
create policy "persons_select_authenticated"
on public.company_persons for select
using (auth.uid() is not null);
