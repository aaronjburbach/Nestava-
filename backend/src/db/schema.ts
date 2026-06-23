// Nestava unified data layer — every tenant table carries org_id (enforced by RLS in sql/rls.sql).
import { pgTable, uuid, text, integer, numeric, jsonb, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const planTier = pgEnum("plan_tier", ["solo","team","brokerage","api_starter","api_growth","api_scale"]);
export const role = pgEnum("role", ["super_admin","brokerage_admin","team_lead","agent","lo","client","api_key"]);

export const orgs = pgTable("orgs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  plan: planTier("plan").default("solo").notNull(),
  brandKit: jsonb("brand_kit"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  clerkId: text("clerk_id").unique(),
  email: text("email").notNull(),
  name: text("name"),
  role: role("role").default("agent").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  address: text("address").notNull(), city: text("city"),
  beds: integer("beds"), baths: integer("baths"), sqft: integer("sqft"), year: integer("year"),
  lot: text("lot"), floodZone: text("flood_zone"),
  riskScore: numeric("risk_score"), listPrice: integer("list_price"),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const ddReports = pgTable("dd_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  propertyAddress: text("property_address").notNull(),
  type: text("type").default("Buyer Defense Report").notNull(),
  riskScore: numeric("risk_score"), payload: jsonb("payload"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), email: text("email"), phone: text("phone"),
  source: text("source"), status: text("status").default("New Lead"),
  propertyAddress: text("property_address"), preApproval: text("pre_approval"), notes: text("notes"),
  doNotCall: boolean("do_not_call").default(false),
  tcpaConsentAt: timestamp("tcpa_consent_at", { withTimezone: true }),
  tcpaConsentIp: text("tcpa_consent_ip"),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const activities = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sequences = pgTable("sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), steps: jsonb("steps"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  propertyAddress: text("property_address"), stage: text("stage").default("New"),
  price: integer("price"), checklist: jsonb("checklist"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(), dueAt: timestamp("due_at", { withTimezone: true }),
  done: boolean("done").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind").notNull(), title: text("title"), channel: text("channel"),
  status: text("status").default("draft"), spend: integer("spend").default(0), body: text("body"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), type: text("type"), theme: text("theme"),
  domain: text("domain"), status: text("status").default("draft"), blocks: jsonb("blocks"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const prospectLeads = pgTable("prospect_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  address: text("address").notNull(), owner: text("owner"), type: text("type"),
  score: integer("score"), skipTraced: boolean("skip_traced").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const mortgageScenarios = pgTable("mortgage_scenarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => contacts.id),
  kind: text("kind").notNull(), inputs: jsonb("inputs"), result: jsonb("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  propertyAddress: text("property_address"), stage: text("stage").default("Active"),
  checklist: jsonb("checklist"), complianceFindings: jsonb("compliance_findings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(), status: text("status").default("draft"), url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(), hashedKey: text("hashed_key").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
