# Payments Capability Dashboard

Internal Fynd dashboard surfacing payment ecosystem health, gateway/MOP mix, refund posture, and Fynd's payments orchestration capabilities. Reads from BigQuery Zenith (`fynd-jio-commerceml-prod.fynd_zenith_data`).

**Live:** https://payments-capability-dashboard.vercel.app *(restricted to @gofynd.com)*

## What it does

A single-page dashboard for ~5–10 internal stakeholders (CPO, Payments leadership, BD, PM) that answers:

1. **How healthy is Fynd's payment ecosystem right now?** — transaction volume, success/failure/refund rates, gateway mix, MOP mix, regional distribution
2. **Where is each PG strong and weak?** — failure-reason drill-down with an independent PG/MOP picker
3. **How does Fynd's orchestration layer stack up?** — capability matrix across the 8 integrated PGs + a dedicated Fynd Orchestration panel

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- NextAuth + Google SSO restricted to `@gofynd.com`
- `@google-cloud/bigquery` against `fynd_zenith_data`
- Recharts for telemetry panels
- Hosted on Vercel; auto-deploys on push to `main`

## Local development

Prereqs: Node 20 LTS, pnpm 9, `gcloud` CLI, and a `@gofynd.com` Google account with read on `fynd_zenith_data`.

```bash
# Install
nvm use 20
pnpm install

# Configure env vars (see .env.example for the full list)
cp .env.example .env.local
# Edit .env.local with NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

# One-time BigQuery auth via Application Default Credentials
gcloud auth application-default login
gcloud config set project fynd-jio-commerceml-prod

# Smoke check — confirms BQ access works
bq query --use_legacy_sql=false \
  'SELECT COUNT(*) FROM `fynd-jio-commerceml-prod.fynd_zenith_data.transaction` WHERE DATE(created_on) = CURRENT_DATE() - 1'

# Run
pnpm dev
```

Then open http://localhost:3000.

## Project layout

```
app/
  api/                Route Handlers — one per panel (metrics, gateway-mix, mop-mix,
                      failures, refunds, geographic, filter-options, capability-matrix)
  dashboard/          Main page (Server Component shell + client panels)
  page.tsx            Sign-in page with OAuth-config detection
components/
  filters/            FilterBar with date/PG/MOP/storefront/seller/channel + Compare toggle
  panels/             MetricCards, GatewayMix, MopMix, Failures, Refunds, Geographic
  matrix/             CapabilityMatrix (sticky-col) + OrchestrationPanel
lib/
  bq/
    client.ts         Singleton BQ client (ADC | service-account JSON env var)
    templates/        Per-panel SQL templates extending buildSliceCTE
  auth.ts             NextAuth config + @gofynd.com signIn callback
  filters.ts          Zod-validated filter envelope + URL ↔ state helpers
  capabilities.ts     Server-only loader for data/capabilities.json
  mop.ts              MOP normalization (Paytm script aliases, GPay, PhonePe)
  store/              Zustand filter store
data/
  capabilities.json   Curated matrix data (5 bands × 31 rows × 7 PGs + orchestration)
public/
  fynd-logo.svg       Brand wordmark (fallback)
  fynd-logo.png       Brand asset (preferred — drop the official PNG here)
  google-icon.svg     Google "G" sign-in icon
```

## Deployment

Pushes to `main` auto-deploy on Vercel. Manual prod deploy:

```bash
export NODE_EXTRA_CA_CERTS=/opt/homebrew/etc/ca-certificates/cert.pem  # corp cert chain
pnpm exec vercel deploy --prod --yes
```

## Contributing

- Conventional Commits (`feat:` / `fix:` / `chore:` / `docs:` / `refactor:` / `test:`)
- Run `pnpm lint` + `pnpm typecheck` + `pnpm test` before pushing
- Small PRs against `main`; squash-merge
- Pre-commit hook (Husky) refuses any commits to `_planning/` or `CLAUDE.md` (project planning docs are local-only)
