# Payments Capability Dashboard

Internal Fynd dashboard surfacing payment ecosystem health, gateway/MOP mix, and Fynd's orchestration capabilities. Reads from BigQuery Zenith (`fynd-jio-commerceml-prod.fynd_zenith_data`). Built with Next.js (App Router) + TypeScript + NextAuth + `@google-cloud/bigquery`.

## Quick start

```bash
nvm use 20
pnpm install
cp .env.example .env.local
# Fill in NEXTAUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (see .env.example)

# One-time BigQuery auth via Application Default Credentials
gcloud auth application-default login
gcloud config set project fynd-jio-commerceml-prod

# Run
pnpm dev
```

## What it does

A single-page dashboard for ~5–10 internal stakeholders (CPO, Payments leadership, BD, PM) that answers:
1. How healthy is Fynd's payment ecosystem right now?
2. Where is each PG strong and weak?
3. How does Fynd's orchestration layer stack up?

## Stack

- Next.js 14+ (App Router) — Vercel-hosted
- TypeScript (strict)
- NextAuth + Google SSO restricted to @gofynd.com
- `@google-cloud/bigquery` against `fynd_zenith_data`
- (Coming: Novus design system, Recharts, react-simple-maps)

## Project layout

See `app/`, `components/`, `lib/`, `data/`. Route Handlers in `app/api/`. BQ client + query templates in `lib/bq/`.

## Contributing

- Conventional Commits.
- Run `pnpm lint` + `pnpm typecheck` + `pnpm test` before pushing.
- Small PRs against `main`; squash-merge.
