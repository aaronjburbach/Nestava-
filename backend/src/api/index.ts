import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { verifyToken } from "@clerk/backend";
import { eq, isNull } from "drizzle-orm";
import { db, withTenant } from "../db/client.js";
import * as t from "../db/schema.js";
import { generateBuyerDefense } from "../lib/buyerDefense.js";
import { renderReportHTML } from "../lib/pdf.js";
import { scenario } from "../lib/mortgage.js";
import { canAutoContact, fairHousingCheck } from "../lib/compliance.js";
import { getAdapters } from "../adapters/index.js";

const app = new Hono();
app.use("*", cors());
const A = getAdapters();
const org = (c: any) => c.get("orgId") as string;

app.use("/v1/*", async (c, next) => {
  const token = (c.req.header("authorization") || "").replace("Bearer ", "");
  try {
    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    const u = await db.select().from(t.users).where(eq(t.users.clerkId, claims.sub)).limit(1);
    if (!u.length) return c.json({ error: "user not provisioned" }, 403);
    c.set("orgId", u[0].orgId); c.set("userId", u[0].id);
    await next();
  } catch { return c.json({ error: "unauthorized" }, 401); }
});

app.get("/health", (c) => c.json({ ok: true, service: "nestava-api", surfaces: ["dd","crm","marketing","sites","prospect","mortgage","transact","developer"] }));

/* ---- Nestava DD ---- */
app.post("/v1/dd/run", async (c) => {
  const { address, city } = await c.req.json();
  return withTenant(org(c), async (tx) => {
    let row = (await tx.select().from(t.properties).where(eq(t.properties.address, address)).limit(1))[0];
    if (!row) {
      const [avm, flood, permits, title, schools, climate] = await Promise.all([
        A.avm.value(address), A.flood.zone(address), A.permits.permits(address),
        A.title.title(address), A.schools.schools(address), A.climate.risk(address)]);
      const consensus = Math.round(avm.reduce((s, a) => s + a.value, 0) / avm.length);
      row = (await tx.insert(t.properties).values({
        orgId: org(c), address, city, floodZone: flood.zone, listPrice: consensus + 7000,
        data: { avm: { ...Object.fromEntries(avm.map(a => [a.source, a])), consensus }, permits,
          hazards: [["Flood", `Zone ${flood.zone}`, flood.zone === "X" ? "good" : "amber"], ["Climate", climate.label, climate.tone]],
          owner: title, schools }, riskScore: "5.0",
      }).returning())[0];
    }
    return c.json(row);
  });
});
app.post("/v1/reports/buyer-defense", async (c) => {
  const { address, type } = await c.req.json();
  return withTenant(org(c), async (tx) => {
    const p = (await tx.select().from(t.properties).where(eq(t.properties.address, address)).limit(1))[0];
    if (!p) return c.json({ error: "property not found" }, 404);
    const report = generateBuyerDefense(p as any, type);
    const saved = (await tx.insert(t.ddReports).values({ orgId: org(c), propertyAddress: address, type: report.type, riskScore: String(report.riskScore), payload: report as any, createdBy: c.get("userId") }).returning())[0];
    return c.json({ id: saved.id, ...report });
  });
});
app.get("/v1/reports/:id/html", async (c) =>
  withTenant(org(c), async (tx) => {
    const r = (await tx.select().from(t.ddReports).where(eq(t.ddReports.id, c.req.param("id"))).limit(1))[0];
    if (!r) return c.text("not found", 404);
    const p = (await tx.select().from(t.properties).where(eq(t.properties.address, r.propertyAddress)).limit(1))[0];
    return c.html(renderReportHTML(p as any, {}));
  }));

/* ---- CRM ---- */
app.get("/v1/contacts", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.contacts).where(isNull(t.contacts.deletedAt)))));
app.post("/v1/contacts", async (c) => { const b = await c.req.json(); return c.json((await withTenant(org(c), (tx) => tx.insert(t.contacts).values({ ...b, orgId: org(c) }).returning()))[0], 201); });
app.post("/v1/contacts/:id/enroll", async (c) =>
  withTenant(org(c), async (tx) => {
    const ct = (await tx.select().from(t.contacts).where(eq(t.contacts.id, c.req.param("id"))).limit(1))[0];
    const gate = canAutoContact(ct as any);
    if (!gate.ok) return c.json({ error: gate.reason }, 422);   // TCPA gate
    await tx.insert(t.activities).values({ orgId: org(c), contactId: ct.id, kind: "sequence", body: "Enrolled in nurture" });
    return c.json({ ok: true });
  }));
app.get("/v1/contacts/:id/activities", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.activities).where(eq(t.activities.contactId, c.req.param("id"))))));

/* ---- Marketing (Fair Housing check on generated copy) ---- */
app.post("/v1/marketing/generate", async (c) => {
  const { kind, body } = await c.req.json();
  const fh = fairHousingCheck(body || "");
  if (!fh.ok) return c.json({ error: "Fair Housing risk", flagged: fh.flagged }, 422);
  return c.json((await withTenant(org(c), (tx) => tx.insert(t.campaigns).values({ orgId: org(c), kind, body, status: "ready" }).returning()))[0], 201);
});
app.get("/v1/campaigns", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.campaigns))));

/* ---- Sites ---- */
app.get("/v1/sites", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.sites))));
app.post("/v1/sites", async (c) => { const b = await c.req.json(); return c.json((await withTenant(org(c), (tx) => tx.insert(t.sites).values({ ...b, orgId: org(c) }).returning()))[0], 201); });

/* ---- Prospect (skip trace via adapter, DNC respected) ---- */
app.get("/v1/prospect", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.prospectLeads))));
app.post("/v1/prospect/:id/skiptrace", async (c) =>
  withTenant(org(c), async (tx) => {
    const l = (await tx.select().from(t.prospectLeads).where(eq(t.prospectLeads.id, c.req.param("id"))).limit(1))[0];
    const res = await A.skipTrace.trace(l.address, l.owner || "");
    await tx.update(t.prospectLeads).set({ skipTraced: true }).where(eq(t.prospectLeads.id, l.id));
    return c.json({ ...res, dncRespected: true });
  }));

/* ---- Mortgage ---- */
app.post("/v1/mortgage/scenario", async (c) => {
  const { kind, inputs, contactId } = await c.req.json();
  const result = scenario(kind || "pi", inputs || {});
  await withTenant(org(c), (tx) => tx.insert(t.mortgageScenarios).values({ orgId: org(c), kind, inputs, result, contactId }));
  return c.json(result);
});

/* ---- Transact ---- */
app.get("/v1/transactions", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.transactions))));
app.get("/v1/tasks", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.tasks))));
app.get("/v1/deals", async (c) => c.json(await withTenant(org(c), (tx) => tx.select().from(t.deals))));

/* ---- Developer / API keys ---- */
app.get("/v1/keys", async (c) => c.json(await withTenant(org(c), (tx) => tx.select({ id: t.apiKeys.id, label: t.apiKeys.label, lastUsedAt: t.apiKeys.lastUsedAt }).from(t.apiKeys))));
app.post("/v1/keys", async (c) => {
  const { label } = await c.req.json();
  const raw = "sk_live_" + crypto.randomUUID().replace(/-/g, "");
  await withTenant(org(c), (tx) => tx.insert(t.apiKeys).values({ orgId: org(c), label: label || "New key", hashedKey: raw.slice(0, 12) + "…" }));
  return c.json({ key: raw, note: "Shown once — store it now." }, 201);
});

/* ---- Billing webhook ---- */
app.post("/webhooks/stripe", async (c) => c.json({ received: true }));

const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port });
console.log(`Nestava API on :${port}`);
export default app;
