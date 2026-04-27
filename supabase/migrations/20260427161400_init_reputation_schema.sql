-- Supabase/PostgreSQL schema for two review types:
-- 1) User reviews (trustpilot-like)
-- 2) Algorithm-driven score events based on scraped and verified findings

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_type_enum') then
    create type public.source_type_enum as enum ('user', 'algorithm', 'manual_admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'review_status_enum') then
    create type public.review_status_enum as enum ('active', 'hidden', 'flagged');
  end if;

  if not exists (select 1 from pg_type where typname = 'job_status_enum') then
    create type public.job_status_enum as enum ('running', 'success', 'failed');
  end if;

  if not exists (select 1 from pg_type where typname = 'verification_status_enum') then
    create type public.verification_status_enum as enum ('pending', 'verified', 'rejected');
  end if;
end $$;

-- Generic timestamp update trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  industry text,
  country_code text,
  base_score integer not null default 100,
  current_score integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_base_score_non_negative check (base_score >= 0)
);

-- User reviews (type #1)
create table if not exists public.user_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  content text not null,
  status public.review_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_reviews_company_id on public.user_reviews(company_id);
create index if not exists idx_user_reviews_user_id on public.user_reviews(user_id);
create index if not exists idx_user_reviews_status on public.user_reviews(status);
create index if not exists idx_user_reviews_created_at on public.user_reviews(created_at desc);

-- Algorithm runs
create table if not exists public.algo_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.job_status_enum not null default 'running',
  algorithm_version text not null,
  raw_input jsonb,
  result_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_algo_runs_company_id on public.algo_runs(company_id);
create index if not exists idx_algo_runs_status on public.algo_runs(status);
create index if not exists idx_algo_runs_started_at on public.algo_runs(started_at desc);

-- Algorithm findings for a run
create table if not exists public.algo_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.algo_runs(id) on delete cascade,
  category_key text not null,
  source_url text not null,
  evidence jsonb,
  confidence numeric(5,4),
  created_at timestamptz not null default now(),
  constraint algo_findings_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists idx_algo_findings_run_id on public.algo_findings(run_id);
create index if not exists idx_algo_findings_category_key on public.algo_findings(category_key);

-- Score events (+/- points), shared by user/algo/manual sources
create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  source_type public.source_type_enum not null,
  source_id uuid,
  points_delta integer not null,
  reason_code text not null,
  reason_text text,
  verification_status public.verification_status_enum not null default 'pending',
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_score_events_company_id on public.score_events(company_id);
create index if not exists idx_score_events_verification_status on public.score_events(verification_status);
create index if not exists idx_score_events_source_type on public.score_events(source_type);
create index if not exists idx_score_events_created_at on public.score_events(created_at desc);

-- Prevent duplicate scoring from the same source entity
create unique index if not exists uq_score_events_source_unique
  on public.score_events(source_type, source_id, reason_code)
  where source_id is not null;

-- Optional snapshots for history/analytics
create table if not exists public.company_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  score integer not null,
  calculated_at timestamptz not null default now(),
  calculation_version text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_company_score_snapshots_company_id
  on public.company_score_snapshots(company_id, calculated_at desc);

-- Compute and refresh current_score based on verified score_events only
create or replace function public.recompute_company_current_score(p_company_id uuid)
returns void
language plpgsql
as $$
declare
  v_base_score integer;
  v_delta_sum integer;
begin
  select base_score into v_base_score
  from public.companies
  where id = p_company_id
  for update;

  if v_base_score is null then
    return;
  end if;

  select coalesce(sum(points_delta), 0) into v_delta_sum
  from public.score_events
  where company_id = p_company_id
    and verification_status = 'verified';

  update public.companies
  set current_score = v_base_score + v_delta_sum
  where id = p_company_id;
end;
$$;

-- Trigger helper on score_events changes
create or replace function public.apply_company_score_on_event_change()
returns trigger
language plpgsql
as $$
declare
  v_company_id uuid;
begin
  v_company_id := coalesce(new.company_id, old.company_id);
  perform public.recompute_company_current_score(v_company_id);
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_score_events_recompute_company_score on public.score_events;
create trigger trg_score_events_recompute_company_score
after insert or update or delete on public.score_events
for each row
execute function public.apply_company_score_on_event_change();

-- Keep current_score aligned if base_score changes
create or replace function public.apply_company_score_on_base_score_change()
returns trigger
language plpgsql
as $$
begin
  if new.base_score is distinct from old.base_score then
    perform public.recompute_company_current_score(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_companies_recompute_current_score on public.companies;
create trigger trg_companies_recompute_current_score
after update of base_score on public.companies
for each row
execute function public.apply_company_score_on_base_score_change();

-- Generic updated_at triggers
drop trigger if exists trg_companies_set_updated_at on public.companies;
create trigger trg_companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

drop trigger if exists trg_user_reviews_set_updated_at on public.user_reviews;
create trigger trg_user_reviews_set_updated_at
before update on public.user_reviews
for each row
execute function public.set_updated_at();

drop trigger if exists trg_algo_runs_set_updated_at on public.algo_runs;
create trigger trg_algo_runs_set_updated_at
before update on public.algo_runs
for each row
execute function public.set_updated_at();

-- Backfill current_score for already existing rows
do $$
declare
  r record;
begin
  for r in select id from public.companies loop
    perform public.recompute_company_current_score(r.id);
  end loop;
end $$;
