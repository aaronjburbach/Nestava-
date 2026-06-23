// Seeds the same demo brokerage + data the prototype ships with — across every surface.
import { db, sql } from "./db/client.js";
import * as t from "./db/schema.js";

async function main() {
  const [org] = await db.insert(t.orgs).values({ name: "Carolina Coast Realty", plan: "brokerage",
    brandKit: { primary: "#0F4C46", accent: "#C2792E", brokerage: "Carolina Coast Realty", license: "NC #C-28841" } }).returning();
  const [dana] = await db.insert(t.users).values({ orgId: org.id, email: "dana@carolinacoast.com", name: "Dana Whitfield", role: "brokerage_admin", clerkId: "seed_dana" }).returning();

  await db.insert(t.properties).values({ orgId: org.id, address: "1234 Oak St", city: "Wilmington, NC 28403",
    beds: 4, baths: 3, sqft: 2840, year: 2016, lot: "0.34 ac", floodZone: "AE", riskScore: "7.2", listPrice: 492000,
    data: { avm: { consensus: 485000, lo: 465000, hi: 510000, band: 1.6 },
      comps: [["1210 Oak St",471000,174,"0.1 mi",-8000],["9 Beacon Ct",498000,167,"0.4 mi",12000]],
      permits: [["Roof replacement","Coastal Roofing LLC","Final / passed","good"],["Deck addition","Owner / unpermitted","Open — never finaled","red"]],
      hazards: [["Flood","Zone AE — 1% annual","amber"],["Wind / hurricane","Zone 2 — moderate","amber"]],
      owner: { name: "Pamela R. Hendricks", tenure: "8 yrs", equity: "≈ 62%" },
      insights: [["amber","Flood Zone AE","FEMA Zone AE — flood insurance required.","FEMA NFHL"],["red","Unpermitted 2018 deck","Never finaled — negotiate a credit.","New Hanover County"],["good","Clean title chain","No liens since 1998.","DataTree"]] } });

  const [marcus] = await db.insert(t.contacts).values({ orgId: org.id, name: "Marcus Reyes", source: "IDX listing click", status: "Hot", propertyAddress: "1234 Oak St", preApproval: "Yes — $512K", tcpaConsentAt: new Date(), tcpaConsentIp: "73.x.x.x" }).returning();
  await db.insert(t.contacts).values([
    { orgId: org.id, name: "Janet & Tom Carter", source: "Web Form", status: "Nurture", propertyAddress: "88 Marsh Pointe Dr", tcpaConsentAt: new Date() },
    { orgId: org.id, name: "Ada Okafor", source: "Open House", status: "New Lead", propertyAddress: "7 Beacon Ct" },
  ]);
  await db.insert(t.activities).values([
    { orgId: org.id, contactId: marcus.id, kind: "view", body: "Viewed 1234 Oak St listing page" },
    { orgId: org.id, contactId: marcus.id, kind: "report", body: "Buyer Defense Report delivered for 1234 Oak St" },
  ]);
  await db.insert(t.tasks).values([
    { orgId: org.id, title: "Call Marcus Reyes — offer follow-up" },
    { orgId: org.id, title: "Send Buyer Defense Report to the Carters" },
    { orgId: org.id, title: "Review NCAR listing agreement — 1234 Oak St" },
  ]);
  await db.insert(t.campaigns).values([
    { orgId: org.id, kind: "Just-listed", title: "Just Listed — 1234 Oak St", channel: "social", status: "live" },
    { orgId: org.id, kind: "Ad", title: "Buyer lead ads", channel: "meta", status: "live", spend: 1200 },
  ]);
  await db.insert(t.sites).values([
    { orgId: org.id, name: "Solo agent", type: "agent", theme: "modern-minimal", domain: "dana.ccr.com", status: "live" },
    { orgId: org.id, name: "Team site", type: "team", theme: "coastal-luxury", domain: "coastteam.com", status: "live" },
  ]);
  await db.insert(t.prospectLeads).values([
    { orgId: org.id, address: "55 Dockside Ln, Wilmington", owner: "R. Castellano", type: "Absentee", score: 91 },
    { orgId: org.id, address: "118 Magnolia Way, Leland", owner: "D. Pruitt", type: "FSBO", score: 86 },
    { orgId: org.id, address: "402 Live Oak Pkwy, Wilmington", owner: "M. Santos", type: "Expired", score: 79 },
  ]);
  await db.insert(t.transactions).values({ orgId: org.id, propertyAddress: "1234 Oak St", stage: "Pending Close",
    checklist: [["Listing agreement signed",true],["Inspection scheduled",true],["Appraisal ordered",false]],
    complianceFindings: [["warn","Due diligence fee not yet documented in Form 2-T"],["warn","Lead-based paint disclosure missing date initials on p.2"]] });

  console.log("Seeded org", org.id, "(Carolina Coast Realty) across all surfaces.");
  await sql.end();
}
main();
