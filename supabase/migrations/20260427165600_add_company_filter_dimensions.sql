-- Add filter dimensions and richer company registry data.

-- Optional extension used for case-insensitive unique identifiers.
create extension if not exists citext;

-- Enums for company naming and identifiers
do $$
begin
  if not exists (select 1 from pg_type where typname = 'company_name_type_enum') then
    create type public.company_name_type_enum as enum ('full', 'short', 'alias', 'homonym');
  end if;

  if not exists (select 1 from pg_type where typname = 'registry_identifier_type_enum') then
    create type public.registry_identifier_type_enum as enum ('nip', 'regon', 'krs', 'vat_eu', 'other');
  end if;
end $$;

-- Dictionaries for filtering
create table if not exists public.legal_forms (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.industries (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.voivodeships (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.reporting_types (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.employment_bands (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  min_employees integer,
  max_employees integer,
  created_at timestamptz not null default now(),
  constraint employment_bands_range_check
    check (
      min_employees is null
      or max_employees is null
      or min_employees <= max_employees
    )
);

create table if not exists public.revenue_bands (
  id bigserial primary key,
  code text not null unique,
  label text not null unique,
  currency_code char(3) not null default 'PLN',
  min_amount numeric(16,2),
  max_amount numeric(16,2),
  created_at timestamptz not null default now(),
  constraint revenue_bands_amount_range_check
    check (min_amount is null or max_amount is null or min_amount <= max_amount)
);

-- Extend companies with filter dimensions
alter table public.companies
  add column if not exists legal_form_id bigint references public.legal_forms(id),
  add column if not exists industry_id bigint references public.industries(id),
  add column if not exists voivodeship_id bigint references public.voivodeships(id),
  add column if not exists reporting_type_id bigint references public.reporting_types(id),
  add column if not exists employment_band_id bigint references public.employment_bands(id),
  add column if not exists revenue_band_id bigint references public.revenue_bands(id),
  add column if not exists city text,
  add column if not exists postal_code text;

create index if not exists idx_companies_legal_form_id on public.companies(legal_form_id);
create index if not exists idx_companies_industry_id on public.companies(industry_id);
create index if not exists idx_companies_voivodeship_id on public.companies(voivodeship_id);
create index if not exists idx_companies_reporting_type_id on public.companies(reporting_type_id);
create index if not exists idx_companies_employment_band_id on public.companies(employment_band_id);
create index if not exists idx_companies_revenue_band_id on public.companies(revenue_band_id);

-- Multiple names/homonyms per company
create table if not exists public.company_names (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name_type public.company_name_type_enum not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique(company_id, name_type, value)
);

create index if not exists idx_company_names_company_id on public.company_names(company_id);
create index if not exists idx_company_names_name_type on public.company_names(name_type);

-- Registry identifiers (NIP, REGON, KRS, etc.)
create table if not exists public.company_registry_identifiers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  identifier_type public.registry_identifier_type_enum not null,
  value citext not null,
  country_code char(2) default 'PL',
  created_at timestamptz not null default now(),
  unique(identifier_type, value, country_code)
);

create index if not exists idx_company_registry_identifiers_company_id
  on public.company_registry_identifiers(company_id);
create index if not exists idx_company_registry_identifiers_type
  on public.company_registry_identifiers(identifier_type);

-- Seed: legal forms requested by business
insert into public.legal_forms (code, label) values
  ('sp_z_oo', 'Spółka z o.o.'),
  ('stowarzyszenie', 'Stowarzyszenie'),
  ('sp_jawna', 'Spółka jawna'),
  ('sp_komandytowa', 'Spółka komandytowa'),
  ('fundacja', 'Fundacja'),
  ('spoldzielnia', 'Spółdzielnia'),
  ('sp_akcyjna', 'Spółka akcyjna'),
  ('zwiazek_zawodowy', 'Związek zawodowy'),
  ('sp_komandytowo_akcyjna', 'Spółka komandytowo-akcyjna'),
  ('oddzial_zagranicznego_przedsiebiorcy', 'Oddział zagranicznego przedsiębiorcy'),
  ('prosta_sp_akcyjna', 'Prosta spółka akcyjna'),
  ('kolko_rolnicze', 'Kółko rolnicze'),
  ('spzoz', 'SPZOZ'),
  ('przedsiebiorstwo_panstwowe', 'Przedsiębiorstwo państwowe'),
  ('izba_gospodarcza', 'Izba gospodarcza')
on conflict (code) do nothing;

-- Seed: all Polish voivodeships
insert into public.voivodeships (code, label) values
  ('dolnoslaskie', 'Dolnośląskie'),
  ('kujawsko_pomorskie', 'Kujawsko-pomorskie'),
  ('lubelskie', 'Lubelskie'),
  ('lubuskie', 'Lubuskie'),
  ('lodzkie', 'Łódzkie'),
  ('malopolskie', 'Małopolskie'),
  ('mazowieckie', 'Mazowieckie'),
  ('opolskie', 'Opolskie'),
  ('podkarpackie', 'Podkarpackie'),
  ('podlaskie', 'Podlaskie'),
  ('pomorskie', 'Pomorskie'),
  ('slaskie', 'Śląskie'),
  ('swietokrzyskie', 'Świętokrzyskie'),
  ('warminsko_mazurskie', 'Warmińsko-mazurskie'),
  ('wielkopolskie', 'Wielkopolskie'),
  ('zachodniopomorskie', 'Zachodniopomorskie')
on conflict (code) do nothing;

-- Seed: reporting types requested
insert into public.reporting_types (code, label) values
  ('inna', 'Inna'),
  ('mikro', 'Mikro'),
  ('mala', 'Mała'),
  ('ngo', 'NGO'),
  ('bank', 'Bank'),
  ('zus', 'ZUS'),
  ('dom_maklerski', 'Dom maklerski'),
  ('skok', 'SKOK')
on conflict (code) do nothing;

-- Seed: employment bands requested
insert into public.employment_bands (code, label, min_employees, max_employees) values
  ('emp_0', '0', 0, 0),
  ('emp_1_49', '1 - 49', 1, 49),
  ('emp_50_249', '50 - 249', 50, 249),
  ('emp_250_999', '250 - 999', 250, 999),
  ('emp_1000_plus', '> 1000', 1000, null)
on conflict (code) do nothing;

-- Seed: broad industry list ("daj ile wlezie")
insert into public.industries (code, label) values
  ('agriculture', 'Rolnictwo'),
  ('forestry', 'Leśnictwo'),
  ('fishing', 'Rybołówstwo'),
  ('mining', 'Górnictwo i wydobycie'),
  ('manufacturing', 'Przetwórstwo przemysłowe'),
  ('energy', 'Energetyka'),
  ('water_waste', 'Wodociągi i gospodarka odpadami'),
  ('construction', 'Budownictwo'),
  ('automotive', 'Motoryzacja'),
  ('logistics', 'Transport i logistyka'),
  ('warehouse', 'Magazynowanie'),
  ('shipping', 'Spedycja'),
  ('ecommerce', 'E-commerce'),
  ('retail', 'Handel detaliczny'),
  ('wholesale', 'Handel hurtowy'),
  ('food_beverage', 'Żywność i napoje'),
  ('hospitality', 'Hotelarstwo i noclegi'),
  ('gastronomy', 'Gastronomia'),
  ('tourism', 'Turystyka'),
  ('healthcare', 'Ochrona zdrowia'),
  ('pharma', 'Farmacja'),
  ('biotech', 'Biotechnologia'),
  ('beauty', 'Kosmetyka i beauty'),
  ('education', 'Edukacja'),
  ('research', 'Badania i rozwój'),
  ('it_software', 'IT i oprogramowanie'),
  ('it_services', 'Usługi IT'),
  ('cybersecurity', 'Cyberbezpieczeństwo'),
  ('telecom', 'Telekomunikacja'),
  ('media', 'Media'),
  ('marketing', 'Marketing i reklama'),
  ('publishing', 'Wydawnictwa'),
  ('finance', 'Finanse'),
  ('banking', 'Bankowość'),
  ('insurance', 'Ubezpieczenia'),
  ('fintech', 'Fintech'),
  ('real_estate', 'Nieruchomości'),
  ('legal', 'Usługi prawne'),
  ('consulting', 'Doradztwo biznesowe'),
  ('accounting', 'Księgowość i podatki'),
  ('hr', 'HR i rekrutacja'),
  ('public_administration', 'Administracja publiczna'),
  ('ngo', 'Organizacje pozarządowe'),
  ('defense', 'Obronność'),
  ('security_services', 'Usługi ochrony'),
  ('cleaning_services', 'Usługi sprzątające'),
  ('facility_management', 'Facility management'),
  ('creative_industries', 'Branże kreatywne'),
  ('fashion', 'Moda'),
  ('sports', 'Sport i rekreacja'),
  ('gaming', 'Gry'),
  ('events', 'Eventy i konferencje'),
  ('home_services', 'Usługi domowe'),
  ('repair_services', 'Serwis i naprawy'),
  ('pet_services', 'Usługi dla zwierząt'),
  ('other', 'Inne')
on conflict (code) do nothing;

-- Seed: revenue bands (can be adjusted later)
insert into public.revenue_bands (code, label, currency_code, min_amount, max_amount) values
  ('rev_0_100k', '0 - 100 tys. PLN', 'PLN', 0, 100000),
  ('rev_100k_1m', '100 tys. - 1 mln PLN', 'PLN', 100000, 1000000),
  ('rev_1m_10m', '1 mln - 10 mln PLN', 'PLN', 1000000, 10000000),
  ('rev_10m_50m', '10 mln - 50 mln PLN', 'PLN', 10000000, 50000000),
  ('rev_50m_250m', '50 mln - 250 mln PLN', 'PLN', 50000000, 250000000),
  ('rev_250m_1b', '250 mln - 1 mld PLN', 'PLN', 250000000, 1000000000),
  ('rev_1b_plus', '> 1 mld PLN', 'PLN', 1000000000, null)
on conflict (code) do nothing;
