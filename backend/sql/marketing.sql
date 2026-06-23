-- Channel connections for the Marketing Studio (Meta/Google ads, social, email, MLS/IDX)
create table if not exists public.integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  channel text not null,
  status text default 'connected',
  config jsonb,
  created_at timestamptz default now()
);
create unique index if not exists integrations_org_channel on public.integrations(org_id, channel);
alter table public.integrations enable row level security;
alter table public.integrations force row level security;
drop policy if exists tenant_rw on public.integrations;
create policy tenant_rw on public.integrations to authenticated
  using (org_id = public.current_org_id()) with check (org_id = public.current_org_id());
drop trigger if exists trg_set_org_id on public.integrations;
create trigger trg_set_org_id before insert on public.integrations for each row execute function public.set_org_id();
grant select, insert, update, delete on public.integrations to authenticated;
