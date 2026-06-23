-- Auth-based multi-tenancy for Supabase (replaces the app.org_id GUC policies).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- current user's org (SECURITY DEFINER avoids RLS recursion on users)
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path=public as $fn$
  select org_id from public.users where auth_id = auth.uid()::text limit 1;
$fn$;

-- replace tenant policies: authenticated users see only their org's rows
do $$
declare t text;
begin
  foreach t in array array['properties','dd_reports','contacts','activities','sequences','deals','tasks',
    'campaigns','sites','prospect_leads','mortgage_scenarios','transactions','documents','api_keys','users']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists tenant_isolation on public.%I;', t);
    execute format('drop policy if exists tenant_rw on public.%I;', t);
    execute format($p$ create policy tenant_rw on public.%I to authenticated
      using (org_id = public.current_org_id())
      with check (org_id = public.current_org_id()); $p$, t);
  end loop;
end $$;

-- auto-fill org_id on insert so the browser never has to send it
create or replace function public.set_org_id() returns trigger
language plpgsql security definer set search_path=public as $fn$
begin
  if new.org_id is null then new.org_id := public.current_org_id(); end if;
  return new;
end $fn$;
do $$
declare t text;
begin
  foreach t in array array['properties','dd_reports','contacts','activities','sequences','deals','tasks',
    'campaigns','sites','prospect_leads','mortgage_scenarios','transactions','documents','api_keys']
  loop
    execute format('drop trigger if exists trg_set_org_id on public.%I;', t);
    execute format('create trigger trg_set_org_id before insert on public.%I for each row execute function public.set_org_id();', t);
  end loop;
end $$;

-- provision a public.users row for every new signup, joining the demo org (beta default)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $fn$
declare demo_org uuid;
begin
  select id into demo_org from public.orgs order by created_at limit 1;
  insert into public.users(org_id, auth_id, email, name, role)
  values (demo_org, new.id::text, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'brokerage_admin')
  on conflict do nothing;
  return new;
end $fn$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
