# Nestava Suite — Layer 2 Backend

Multi-tenant API + data layer behind the Nestava real-estate platform.
**Postgres 16 (PostGIS + pgvector) · Drizzle · Hono · Clerk · Stripe**, with a vendor-adapter
layer so Layer-3 live data is a config swap, and compliance guardrails built in.

## Highlights
- **Unified schema** (`src/db/schema.ts`) — 15 tenant tables, all `org_id`-scoped.
- **Row-Level Security** (`sql/rls.sql`) — tenant isolation enforced in Postgres.
- **Every surface has endpoints** — DD, CRM, Marketing, Sites, Prospect, Mortgage, Transact, Developer (see map below).
- **Vendor adapters** (`src/adapters/`) — typed interfaces + mock impls for AVM, flood, permits, title, schools, climate, skip-trace, MLS. Swap to live without touching the API.
- **Compliance** (`src/lib/compliance.ts`) — TCPA consent gate on outreach, Fair-Housing classifier on generated copy, CAN-SPAM footer, disclaimer injection.
- **Report engine** (`src/lib/buyerDefense.ts`) + **PDF HTML** (`src/lib/pdf.ts`).
- **Typed SDK** (`src/sdk.ts`) for the frontend · **OpenAPI** (`openapi.yaml`) · **CI** + **Dockerfile** + **fly.toml**.

## Run locally (~5 min, no cloud accounts)
```bash
cp .env.example .env
docker compose up -d
npm install
npm run setup        # db:push + db:rls + seed
npm run dev          # http://localhost:8787/health
```

## Surface → endpoint map
| Surface | Endpoints |
|---|---|
| DD | `POST /v1/dd/run`, `POST /v1/reports/buyer-defense`, `GET /v1/reports/:id/html` |
| CRM | `GET/POST /v1/contacts`, `POST /v1/contacts/:id/enroll` (TCPA-gated), `GET /v1/contacts/:id/activities` |
| Marketing | `POST /v1/marketing/generate` (Fair-Housing checked), `GET /v1/campaigns` |
| Sites | `GET/POST /v1/sites` |
| Prospect | `GET /v1/prospect`, `POST /v1/prospect/:id/skiptrace` (DNC-respected) |
| Mortgage | `POST /v1/mortgage/scenario` |
| Transact | `GET /v1/transactions`, `GET /v1/tasks`, `GET /v1/deals` |
| Developer | `GET/POST /v1/keys` |
| Billing | `POST /webhooks/stripe` |

## PDF
`renderReportHTML()` returns print-ready HTML. To emit a PDF, run it through Puppeteer (`page.setContent(html); page.pdf()`) or `react-pdf` in a BullMQ worker.

## Deploy & live data
See **ACCOUNT_SETUP.md** for the exact account/keys checklist (Neon, Clerk, Stripe, Fly/Vercel) and the Layer-3 vendor + legal steps.
