# Payments Capability Dashboard

Internal Fynd dashboard surfacing payment ecosystem health, gateway/MOP mix, refund posture, and Fynd's payments orchestration capabilities. Reads from BigQuery Zenith (`fynd-jio-commerceml-prod.fynd_zenith_data`).

**Live:** https://payments-capability-dashboard.vercel.app

> 🔒 **Internal · do not share externally.** The deploy URL is currently public (auth deferred); the page itself declares its audience via a banner. Anyone with the link sees Fynd payment volumes, success/failure rates, and PG-level breakdowns.

## What this answers

A single-page dashboard for ~5–10 internal stakeholders (CPO, Payments leadership, BD, PM):

1. **How healthy is the ecosystem right now?** Transaction volume, success rate, failure rate, AOV, successful GMV, refund rate — all with prior-period deltas and explicit date labels.
2. **Which gateways carry the load — and which ones perform?** Gateway leaderboard (SR × volume share) + gateway mix bars.
3. **Where do payments come from?** Surface split (online storefront / in-store POS / headless Nexus) + online & offline MOP mix.
4. **Why are payments failing?** Failure-reason breakdown with an independent gateway/method picker.
5. **Where are customers?** State-level India heatmap, shaded by chosen MOP preference.
6. **What does each gateway offer that Fynd integrates?** Curated capability matrix across 8 integrated PGs.

## What's deliberately NOT in v0

- Auth on the deployed URL (the internal banner is the current gate)
- BIN / card-network slice (needs `payment_mode_identifier` parsing)
- PG fee / cost-of-payments view (needs curated fee data)
- Orchestration routing telemetry (needs routing-decision data)
- Absolute KPI benchmarks ("what is good SR") — needs a product call
- Tests beyond typecheck + lint

## Stack

- **Next.js 14** App Router · React 18 · TypeScript (strict)
- **BigQuery** via `@google-cloud/bigquery` against `fynd-jio-commerceml-prod.fynd_zenith_data`
- **Recharts** for charts; **react-simple-maps** + d3-scale for the choropleth
- **SWR** for client-side data fetching with 5-minute dedup
- **Zustand** for filter state, mirrored to the URL via `useFilterUrlSync`
- Hosted on **Vercel**, deploys on push to `main`
- Daily-batch BQ sync (Boltic) — data lag ~12–24h; the topbar shows the most-recent transaction timestamp

## Local development

Prereqs: Node 20 LTS, pnpm 9, `gcloud` CLI, and a Google account with BigQuery read on `fynd_zenith_data`.

```bash
# Install
nvm use 20
pnpm install

# Configure env vars
cp .env.example .env.local
# .env.local needs GCP_SERVICE_ACCOUNT_JSON (or use ADC via gcloud below)

# Option A — Application Default Credentials (preferred for local dev)
gcloud auth application-default login
gcloud config set project fynd-jio-commerceml-prod

# Option B — paste a service-account JSON into .env.local as GCP_SERVICE_ACCOUNT_JSON

# Smoke check
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `fynd-jio-commerceml-prod.fynd_zenith_data.dbe_transaction` WHERE DATE(created_on) = CURRENT_DATE() - 1'

# Run
pnpm dev
```

Then open http://localhost:3000/dashboard.

### Useful scripts

```bash
pnpm dev            # next dev with HMR
pnpm build          # production build (run before deploys)
pnpm lint           # next lint (eslint)
pnpm typecheck      # tsc --noEmit (strict)
pnpm test           # vitest run  (currently scaffolded; no specs)
```

## Project layout

```
app/
  api/
    metrics/                  KPI cards — current vs previous period
    gateway-mix/              Leaderboard + bar mix (gateway-decided SR)
    mop-mix/  mop-mix-offline Online / offline MOP mix
    failures/                 Failure-reason breakdown
    refunds/  refund-posture  Refund volume + method inference
    geographic/               Surface split (ordering_source)
    regional/                 State-level heatmap data
    capability-matrix/        Curated matrix (data/capabilities.json)
    freshness/                MAX(created_on) — topbar data-as-of
    filter-options/           Dropdown values for FilterBar
  dashboard/page.tsx          Main page: topbar → FilterBar → digest → WhatChanged → KPIs → panels → footer
  error.tsx / not-found.tsx   Global error boundary + 404
  layout.tsx                  Metadata, favicon, viewport, OG
components/
  FilterBar.tsx               Date / Gateway / Payment method / Storefront / Seller / Surface
  FilterDigest.tsx            Always-visible chrome strip showing the active filter state
  SectionNav.tsx              Sticky in-page nav with scroll-spy highlight
  WhatChanged.tsx             Top-2 biggest deltas vs prior period
  DataFreshness.tsx           Topbar "Data as of {dt}" indicator
  DashboardFooter.tsx         Methodology + definitions + data lineage
  panels/                     Per-section panels (chart components)
  matrix/                     Capability matrix + orchestration panel
  ui/Panel.tsx                Shared wrapper — title / subtitle / loading skeleton / error
lib/
  bq/
    client.ts                 Singleton BQ client (ADC | service-account JSON)
    templates/base.ts         The shared `slice` CTE — latest_status / aggregator_dedup / exclusions
    templates/<panel>.ts      Per-panel SQL extending the slice
  filters.ts                  Zod-validated filter envelope · previousPeriodFor · URL helpers
  store/filters.ts            Zustand store
  capabilities.ts             Server-only loader for data/capabilities.json
  mop.ts                      MOP normalization (Paytm script aliases, GPay, PhonePe)
  state-rollup.ts             Canonicalize delivery_state → 36 Indian states for heatmap
  normalizations.ts           Failure-category + refund-method bucketing
  gateways.ts                 Stable PG colour + display name
data/
  capabilities.json           Curated matrix data (5 bands × 30 rows × 8 PGs)
public/
  fynd-icon.png  fynd-logo.svg
```

## How the headline numbers are computed

See the methodology footer at the bottom of `/dashboard` for the canonical definitions. Quick summary:

| Metric | Formula |
|---|---|
| KPI **Success rate** | success ÷ **all** transactions (denominator includes Fynd 2h-cancels + uncategorized) |
| Gateway-leaderboard **SR** | success ÷ (success + gateway-declined) — excludes 2h-cancels for fair PG-vs-PG comparison |
| **Failure rate** | (all non-successful) ÷ all transactions — composed of gateway declines + 2h-cancels + uncategorized |
| **Successful GMV** | SUM(amount) on transactions with success unified status |
| **Refund rate** | refund value in window ÷ successful GMV in window |
| **Regional coverage** | mapped Indian-state orders ÷ total orders in slice (~70% — gap = international + non-canonical states) |

## Deployment

Pushes to `main` auto-deploy on Vercel. Manual prod deploy:

```bash
export NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem
pnpm exec vercel deploy --prod --yes
```

Required Vercel env vars: `GCP_SERVICE_ACCOUNT_JSON` (full JSON), `BQ_PROJECT`, `BQ_DATASET`, `BQ_LOCATION`.

## Contributing

- Conventional Commits (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`)
- Run `pnpm lint && pnpm typecheck` before pushing
- Small PRs against `main`; squash-merge
- Pre-commit hook (Husky) refuses any commits to `_planning/` or `CLAUDE.md` (project planning docs are local-only)

## Key decisions on record

- **Two success-rate formulas live together** — KPI card (Fynd-ecosystem view) uses `success/total`; gateway leaderboard uses `success/(success+failed)` to compare PGs fairly. Both labelled in their respective panels and explained in the methodology footer.
- **All `pending` transactions count as failures** — Fynd's 2-hour internal cancel rule means a transaction stuck in `authorized`/`pending` is dead from the customer's perspective. The KPI denominator includes them.
- **Cashfree is not a customer-facing PG at Fynd** — it's the COD-refund settlement handler. It's excluded from PG panels (slice filters `transaction_type <> 'REFUND'`) and only appears in the settlement band of the capability matrix.
- **Capability matrix is partially populated** — ~50% of cells are explicit values; the rest default to "Not offered" and the matrix footer discloses the coverage %. The honest unknown is preferred to invented data.
