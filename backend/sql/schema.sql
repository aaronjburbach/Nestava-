-- Nestava unified schema (Postgres / Supabase). Idempotent.
do $$ begin if not exists (select 1 from pg_type where typname='plan_tier') then
  create type plan_tier as enum ('solo','team','brokerage','api_starter','api_growth','api_scale'); end if; end $$;
do $$ begin if not exists (select 1 from pg_type where typname='user_role') then
  create type user_role as enum ('super_admin','brokerage_admin','team_lead','agent','lo','client','api_key'); end if; end $$;

create table if not exists orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan plan_tier not null default 'solo',
  brand_kit jsonb,
  stripe_customer_id text,
  created_at timestamptz default now());

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  auth_id text unique,
  email text not null,
  name text,
  role user_role not null default 'agent',
  created_at timestamptz default now());

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  address text not null, city text,
  beds int, baths int, sqft int, year int, lot text, flood_zone text,
  risk_score numeric, list_price int, data jsonb,
  created_at timestamptz default now());

create table if not exists dd_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  property_address text not null, type text not null default 'Buyer Defense Report',
  risk_score numeric, payload jsonb, created_by uuid references users(id),
  created_at timestamptz default now());

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, email text, phone text, source text,
  status text default 'New Lead', property_address text, pre_approval text, notes text,
  do_not_call boolean default false, tcpa_consent_at timestamptz, tcpa_consent_ip text,
  unsubscribed_at timestamptz, deleted_at timestamptz,
  created_at timestamptz default now());

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  kind text not null, body text, created_at timestamptz default now());

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, steps jsonb, created_at timestamptz default now());

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  contact_id uuid references contacts(id), property_address text,
  stage text default 'New', price int, checklist jsonb, created_at timestamptz default now());

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  title text not null, due_at timestamptz, done boolean default false,
  created_at timestamptz default now());

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null, title text, channel text, status text default 'draft',
  spend int default 0, body text, created_at timestamptz default now());

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, type text, theme text, domain text, status text default 'draft',
  blocks jsonb, created_at timestamptz default now());

create table if not exists prospect_leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  address text not null, owner text, type text, score int,
  skip_traced boolean default false, created_at timestamptz default now());

create table if not exists mortgage_scenarios (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  contact_id uuid references contacts(id), kind text not null,
  inputs jsonb, result jsonb, created_at timestamptz default now());

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  property_address text, stage text default 'Active',
  checklist jsonb, compliance_findings jsonb, created_at timestamptz default now());

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  name text not null, status text default 'draft', url text, created_at timestamptz default now());

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  label text not null, hashed_key text not null, last_used_at timestamptz,
  created_at timestamptz default now());
