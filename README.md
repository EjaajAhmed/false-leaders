# FalseLeaders

[falseleaders.com](https://falseleaders.com)

A political transparency platform. FalseLeaders collects public-record information about elected officials including documented controversies, campaign and third-party funding, foreign influence flags, and stated policy positions — and presents it as a single browsable profile per politician.

Coverage currently spans Canadian federal politicians. Additional countries are planned.

> **Status:** active development. Data coverage is incomplete and features are still landing. Treat everything here as a work in progress.

---

## Why

Information about a politician's record is public but scattered across lobbying registries, financial disclosures, Hansard, and news archives. FalseLeaders consolidates it into one profile with citations, so a claim about a politician can be traced back to its source rather than taken on trust.

## Features

- **Politician profiles** — biography, current position, riding, and party, with a consolidated record of controversies, funding sources, and influence flags.
- **Scoring model** — each politician carries a rating derived from a configurable ruleset. Weights and deduction rules live in the database and are served through a config endpoint, so the model can be tuned without a redeploy.
- **Article analyzer** — submits news articles to an LLM to extract structured, reviewable claims rather than free-form summaries.
- **Riding map** — Leaflet map built from parsed electoral coordinate data.
- **Charts** — Recharts breakdowns of funding and score composition.
- **Accounts** — JWT authentication with bcrypt password hashing, email verification via Resend, and rate limiting on sensitive routes. Verified users can comment, vote, and bookmark politicians.
- **Notifications** — updates on bookmarked politicians.

## Tech stack

**Frontend** — React 19, TypeScript, Vite, React Router, TanStack Query, Leaflet, Recharts. Deployed to Cloudflare via Wrangler.

**Backend** — Fastify (TypeScript) on Node 20+, PostgreSQL over `pg`, Redis for caching, Resend for transactional email, JWT for auth.

**Tooling** — npm workspaces monorepo, ESLint, `tsx` for local dev and migrations.

## Repository layout

```
apps/
  frontend/          React + Vite client
  backend/           Fastify API
    src/
      index.ts       server bootstrap, CORS, JWT, route registration
      routes/        auth, politicians, controversies, funding, influence,
                     grafts, comments, votes, bookmarks, notifications,
                     home, config, analyze
      db/
        migrate.ts   migration runner
packages/            shared code
global-bundle.pem    RDS certificate bundle for TLS database connections
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL 14 or newer
- Redis
- API keys for Resend and the LLM provider used by the analyzer

### Setup

```bash
git clone https://github.com/EjaajAhmed/false-leaders.git
cd false-leaders
npm install
```

Create `apps/backend/.env`:

```
DATABASE_URL=postgres://user:password@host:5432/falseleaders
PGSSLROOTCERT=./global-bundle.pem
REDIS_URL=redis://localhost:6379
JWT_SECRET=
RESEND_API_KEY=
GEMINI_API_KEY=
PORT=8080
```

Create `apps/frontend/.env`:

```
VITE_API_URL=http://localhost:8080
```

Run the migrations, then start both apps in separate terminals:

```bash
npm --workspace=apps/backend run migrate
npm run dev:backend
npm run dev:frontend
```

The client runs on `http://localhost:5173` and the API on `http://localhost:8080`. `GET /health` confirms the API is up.

### Build

```bash
npm --workspace=apps/backend run build
npm --workspace=apps/frontend run build
```

## API

All routes are namespaced by prefix. Endpoints under `/comments`, `/votes`, `/bookmarks`, and `/notifications` require a verified account; the rest are public reads.

| Prefix | Purpose |
| --- | --- |
| `/auth` | registration, login, email verification |
| `/politicians` | profiles, listings, article analysis |
| `/controversies` | documented incidents attached to a politician |
| `/funding` | campaign and third-party contributions |
| `/influence` | foreign and lobbying influence records |
| `/grafts` | corruption records |
| `/comments`, `/votes` | user discussion |
| `/bookmarks`, `/notifications` | follow politicians and receive updates |
| `/home` | homepage aggregates |
| `/config` | scoring weights and rules |
| `/health` | liveness check |

## Roadmap

- Expand coverage beyond Canada
- Provincial and municipal officials
- Public documentation of the scoring methodology
- Source citation on every record
- Public API access

## A note on accuracy

Records are compiled from public sources and may be incomplete, out of date, or wrong. Scores are a summary of the underlying records under one particular weighting — they are an editorial aid, not a verdict on any individual. Corrections are welcome; open an issue with the source.

## License

Not yet licensed. All rights reserved pending a decision.
