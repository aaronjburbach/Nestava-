# Your Morning To-Do — accounts & keys to take Nestava live

Everything below is gated on accounts only you can create. ~60–90 min total.
Each step says exactly what to make and which env var to paste it into (`.env`).

## A. Core infra (do first — unblocks a live backend)
1. **Neon** (Postgres) → neon.tech → New Project → copy connection string → `DATABASE_URL`.
   Then locally/CI: `npm run db:push && npm run db:rls && npm run seed`.
2. **Clerk** (auth) → clerk.com → New Application → API Keys → `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`.
   In Clerk, enable Organizations (multi-tenant brokerages).
3. **Stripe** (billing) → dashboard.stripe.com → Developers → API keys → `STRIPE_SECRET_KEY`.
   Create Products/Prices (Solo $99, Team $299, Brokerage custom, API tiers) → put price IDs in `src/billing/stripe.ts`.
   Add a webhook to `/webhooks/stripe` → `STRIPE_WEBHOOK_SECRET`.
4. **Hosting** → Fly.io (`fly launch` + `fly secrets set …` from .env) for the API; Vercel for the frontend.

## B. Decisions I need from you (5 min)
- Confirm brand: **Nestava** or **Site Clear**? (one-line swap)
- Entity for the vendor/MLS contracts: existing LLC or a new Delaware C-corp?
- First MLS market(s): start with one (e.g., Cape Fear / NC Regional) to limit approval scope?

## C. Layer-3 data vendors (parallel; longer lead times — start the applications)
| Vendor | Purpose | Notes |
|---|---|---|
| FEMA NFHL | Flood zones | Free/public — I can wire now |
| ATTOM or HouseCanary | AVM + public records | Contract; ask for per-call pricing |
| DataTree (First American) | Title / liens / owner | Account required |
| GreatSchools | School ratings | API key |
| First Street | Climate risk | API key |
| BatchData | Skip trace | Pay-as-you-go; needs CCPA terms |
| Bridge Interactive | MLS / IDX feed | **Per-MLS broker approval (4–8 wks)** — needs your license |
| DocuSeal | E-signature | Self-host or hosted license |

## D. Legal (start in parallel — gates public launch)
- Real-estate/mortgage attorney to review: TCPA consent language, RESPA co-marketing, Fair-Housing policy, MLS IDX display rules. I'll hand them a compliance brief to minimize hours.

## When you've done A + B
Drop the keys in and I'll: deploy the API, point the app at it (live data flag), wire Clerk login + Stripe checkout, and we're running on real accounts.
