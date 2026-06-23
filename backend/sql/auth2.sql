-- Each user sees only their own org
alter table public.orgs enable row level security;
alter table public.orgs force row level security;
drop policy if exists org_self on public.orgs;
create policy org_self on public.orgs to authenticated
  using (id = public.current_org_id()) with check (id = public.current_org_id());

-- New signups create their OWN brokerage org from signup metadata
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $fn$
declare neworg uuid; bname text; uname text;
begin
  bname := coalesce(nullif(new.raw_user_meta_data->>'brokerage',''),'My Brokerage');
  uname := coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1));
  insert into public.orgs(name, plan) values (bname, 'solo') returning id into neworg;
  insert into public.users(org_id, auth_id, email, name, role)
  values (neworg, new.id::text, new.email, uname, 'brokerage_admin') on conflict do nothing;
  return new;
end $fn$;

-- Migrate existing real users off the shared demo org into their own fresh org
do $$
declare u record; neworg uuid; demo uuid;
begin
  select id into demo from public.orgs where name='Carolina Coast Realty' order by created_at limit 1;
  if demo is null then return; end if;
  for u in select id from public.users where org_id = demo and auth_id <> 'seed_dana'
  loop
    insert into public.orgs(name, plan) values ('My Brokerage','solo') returning id into neworg;
    update public.users set org_id = neworg, role='brokerage_admin' where id = u.id;
  end loop;
end $$;
