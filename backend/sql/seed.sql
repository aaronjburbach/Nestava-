do $$
declare oid uuid;
begin
  if exists (select 1 from orgs where name='Carolina Coast Realty') then
    return; -- already seeded
  end if;
  insert into orgs(name,plan,brand_kit)
    values('Carolina Coast Realty','brokerage',
      $json${"primary":"#0F4C46","accent":"#C2792E","brokerage":"Carolina Coast Realty","license":"NC #C-28841"}$json$::jsonb)
    returning id into oid;
  perform set_config('app.org_id', oid::text, true);

  insert into users(org_id,auth_id,email,name,role)
    values(oid,'seed_dana','dana@carolinacoast.com','Dana Whitfield','brokerage_admin');

  insert into properties(org_id,address,city,beds,baths,sqft,year,lot,flood_zone,risk_score,list_price,data) values
   (oid,'1234 Oak St','Wilmington, NC 28403',4,3,2840,2016,'0.34 ac','AE',7.2,492000,
     $json${"avm":{"consensus":485000,"lo":465000,"hi":510000,"band":1.6},
       "comps":[["1210 Oak St",471000,174,"0.1 mi",-8000],["9 Beacon Ct",498000,167,"0.4 mi",12000]],
       "permits":[["Roof replacement","Coastal Roofing LLC","Final / passed","good"],["Deck addition","Owner / unpermitted","Open — never finaled","red"]],
       "hazards":[["Flood","Zone AE — 1% annual","amber"],["Wind / hurricane","Zone 2 — moderate","amber"]],
       "owner":{"name":"Pamela R. Hendricks","tenure":"8 yrs","equity":"approx 62%"},
       "insights":[["amber","Flood Zone AE","FEMA Zone AE — flood insurance required.","FEMA NFHL"],["red","Unpermitted 2018 deck","Never finaled — negotiate a credit.","New Hanover County"],["good","Clean title chain","No liens since 1998.","DataTree"]]}$json$::jsonb),
   (oid,'88 Marsh Pointe Dr','Leland, NC 28451',3,2,1960,2019,'0.22 ac','X',3.1,418000,$json${"avm":{"consensus":418000}}$json$::jsonb);

  insert into contacts(org_id,name,source,status,property_address,pre_approval,tcpa_consent_at) values
   (oid,'Marcus Reyes','IDX listing click','Hot','1234 Oak St','Yes — $512K', now()),
   (oid,'Janet & Tom Carter','Web Form','Nurture','88 Marsh Pointe Dr',null, now()),
   (oid,'Ada Okafor','Open House','New Lead','7 Beacon Ct',null,null);

  insert into tasks(org_id,title) values
   (oid,'Call Marcus Reyes — offer follow-up'),
   (oid,'Send Buyer Defense Report to the Carters'),
   (oid,'Review NCAR listing agreement — 1234 Oak St');

  insert into campaigns(org_id,kind,title,channel,status,spend) values
   (oid,'Just-listed','Just Listed — 1234 Oak St','social','live',0),
   (oid,'Ad','Buyer lead ads','meta','live',1200);

  insert into sites(org_id,name,type,theme,domain,status) values
   (oid,'Solo agent','agent','modern-minimal','dana.ccr.com','live'),
   (oid,'Team site','team','coastal-luxury','coastteam.com','live');

  insert into prospect_leads(org_id,address,owner,type,score) values
   (oid,'55 Dockside Ln, Wilmington','R. Castellano','Absentee',91),
   (oid,'118 Magnolia Way, Leland','D. Pruitt','FSBO',86),
   (oid,'402 Live Oak Pkwy, Wilmington','M. Santos','Expired',79);

  insert into transactions(org_id,property_address,stage,checklist,compliance_findings) values
   (oid,'1234 Oak St','Pending Close',
     $json$[["Listing agreement signed",true],["Inspection scheduled",true],["Appraisal ordered",false]]$json$::jsonb,
     $json$[["warn","Due diligence fee not yet documented in Form 2-T"],["warn","Lead-based paint disclosure missing date initials on p.2"]]$json$::jsonb);
end $$;
