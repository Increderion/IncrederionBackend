-- Fresh schema for new project scope.
-- Users: email/password in auth.users + username in public.profiles
-- Companies, Events, Reports

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- USERS (public profile fields)
-- Mail and password are managed by Supabase Auth in auth.users.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, 'user_' || substr(new.id::text, 1, 8))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- COMPANIES
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nip text unique,
  krs text unique,
  regon text unique,
  legal_form text,
  industry text,
  registration_date date,
  president_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_companies_name on public.companies(name);
create index if not exists idx_companies_industry on public.companies(industry);

drop trigger if exists trg_companies_set_updated_at on public.companies;
create trigger trg_companies_set_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();

-- EVENTS
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  flag boolean not null default false,
  title text not null,
  description text,
  event_date timestamptz not null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_events_company_id on public.events(company_id);
create index if not exists idx_events_event_date on public.events(event_date desc);
create index if not exists idx_events_flag on public.events(flag);

-- REPORTS
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists idx_reports_company_id on public.reports(company_id);
create index if not exists idx_reports_user_id on public.reports(user_id);

-- Basic RLS
alter table public.profiles enable row level security;
alter table public.reports enable row level security;
alter table public.companies enable row level security;
alter table public.events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
on public.reports
for select
using (user_id = auth.uid());

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
on public.reports
for insert
with check (user_id = auth.uid());

drop policy if exists "reports_delete_own" on public.reports;
create policy "reports_delete_own"
on public.reports
for delete
using (user_id = auth.uid());

-- Companies and events are readable for authenticated users.
drop policy if exists "companies_select_authenticated" on public.companies;
create policy "companies_select_authenticated"
on public.companies
for select
using (auth.uid() is not null);

drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated"
on public.events
for select
using (auth.uid() is not null);
