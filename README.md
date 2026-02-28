# Event Taxonomy Tracker (Tracking Plan Platform Rewrite)

This repository now uses a local-first TypeScript monorepo for a workflow-first analytics planning platform.

## What Changed

- New architecture with npm workspaces:
  - `apps/web`: React 19 + Vite + TypeScript SPA
  - `apps/api`: Fastify + Drizzle + SQLite API server
  - `packages/contracts`: shared Zod schemas + inferred types
  - `storage/`: local uploaded source files
- Legacy Python/frontend code has been removed from the active codebase.

## Product Model

- `Feature` is the top-level workspace.
- Each Feature owns one mutable `Tracking Plan`.
- `Requirements` are extracted/manual planning units.
- `Catalog` stores published definitions only.
- `Release` is immutable publish output.

## Local Development

1. Install workspace dependencies:

```bash
npm install --verbose
```

2. Start API + web app:

```bash
npm run dev
```

3. Open:

- Web: [http://localhost:5173](http://localhost:5173)
- API health: [http://localhost:8000/api/health](http://localhost:8000/api/health)

## AI Setup (Optional)

AI actions are explicit-trigger only. If environment variables are missing, AI is disabled in the UI.

Set these for `apps/api` runtime:

```bash
export OPENAI_API_KEY="..."
export AI_MODEL="gpt-4o-mini"
```

## Current Coverage

Implemented surfaces include:

- Feature workspace routes (`overview`, `prd`, `requirements`, `tracking-plan`, `validation`, `review`)
- Source ingest (paste + upload metadata, local file storage, parser fallbacks)
- Requirements CRUD + ordering
- Tracking plan event CRUD + requirement links
- Deterministic validation recompute and issue persistence
- Lightweight comments/threads
- AI run lifecycle endpoints with polling + SSE stream endpoint
- Whole-plan publish path + release/version writes
- Catalog views, event detail, version history, property registry
- Standalone `New Event` flow

## Testing

Run all workspace tests:

```bash
npm run test
```

Run type checks:

```bash
npm run typecheck
```

## Notes

- Persistence uses local SQLite (`apps/api/data/tracking-plan.db`) and filesystem storage (`storage/`).
- No auth/permissions, no remote DB, and no deployment pipeline are included in this version.
