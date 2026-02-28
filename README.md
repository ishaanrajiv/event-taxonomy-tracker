# Event Taxonomy Tracker

A POC tool for managing analytics event taxonomies with property registry, conflict detection, and automatic changelog.

## Security Notice

This project is a development-focused POC.

Before production use, add authentication, hardened CORS, production database, rate limiting, security headers, logging, and monitoring.

## Stack

- API: Bun + TypeScript + Hono + SQLite
- UI: React 19 + TypeScript + Vite + Tailwind
- Workspace: Bun workspaces (`apps/api`, `apps/frontend`)

## Quick Start

```bash
# Install dependencies for the whole workspace
bun install

# Run API + frontend
bun run dev
```

Then visit:
- Frontend: http://localhost:5173
- API: http://localhost:8000

## Verify

```bash
# Full typecheck + tests
bun run verify

# Frontend only
bun run verify:frontend

# API only
bun run test:api
```

## API Endpoints

### Events
- `GET /api/events`
- `POST /api/events`
- `GET /api/events/{id}`
- `PUT /api/events/{id}`
- `POST /api/events/{id}/archive`
- `POST /api/events/{id}/restore`
- `GET /api/events/{id}/versions`
- `GET /api/events/{id}/versions/{version_number}`
- `POST /api/events/{id}/versions/{version_number}/revert`

### Properties
- `GET /api/properties`
- `POST /api/properties`
- `GET /api/properties/suggest?q=<name>`

### Changelog/Search/Filters
- `GET /api/changelog`
- `GET /api/search?q=<term>`
- `GET /api/features`
- `GET /api/filter-options`

### Import/Export
- `GET /api/export/template/json`
- `GET /api/export/template/csv`
- `POST /api/import/json`
- `POST /api/import/csv`

## Project Layout

```text
event-taxonomy-tracker/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   ├── test/
│   │   └── package.json
│   └── frontend/
│       ├── src/
│       └── package.json
├── package.json
└── bun.lock
```
