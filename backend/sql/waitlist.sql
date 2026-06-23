-- Public waitlist capture (anon can insert; no one can read via the API)
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text, email text, brokerage text,
  created_at timestamptz default now()
);
alter table public.waitlist enable row level security;
drop policy if exists waitlist_insert on public.waitlist;
create policy waitlist_insert on public.waitlist for insert to anon, authenticated with check (true);
grant insert on public.waitlist to anon, authenticated;
