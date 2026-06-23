-- Tenant isolation via RLS (idempotent). Policies read current_setting('app.org_id').
do $$
declare t text;
begin
  foreach t in array array['properties','dd_reports','contacts','activities','sequences','deals','tasks',
    'campaigns','sites','prospect_leads','mortgage_scenarios','transactions','documents','api_keys','users']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format('drop policy if exists tenant_isolation on %I;', t);
    execute format($p$ create policy tenant_isolation on %I
      using (org_id = current_setting('app.org_id', true)::uuid)
      with check (org_id = current_setting('app.org_id', true)::uuid); $p$, t);
  end loop;
end $$;
