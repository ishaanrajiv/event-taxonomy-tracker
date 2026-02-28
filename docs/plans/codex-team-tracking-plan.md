# Codex Team Tracking Plan

## Summary

This plan is split into two phases:

1. **Phase 1 (now):** Single-user, local SQLite, no auth/roles/remote infrastructure, but includes all new workflow features including LLM-based PRD event generation.
2. **Phase 2 (later):** Production hardening (auth, roles, hosted DB, governance, observability) without redesigning the core workflow.

The existing design language and layout stay intact. We extend the current app shell rather than redesigning it.

## Product Goal

Move from ad-hoc event entry to a team-oriented planning flow:

`Tracking Plan -> Instrumentation Scope -> Draft Events -> Validation -> Share -> Publish to Catalog`

The analyst can start from PRD text, manually edit events, and optionally generate drafts via LLM.

## Phase 1: Local-First Implementation (Build This Now)

### Scope Constraints

- Single user only.
- Local SQLite only.
- No authentication.
- No user roles/permissions.
- No remote DB.
- Breaking changes allowed for POC speed.

### Core Features Included

- Tracking Plan management.
- Instrumentation Scope management under each plan.
- PRD ingestion via pasted text.
- Draft event and property authoring inside scope.
- Scope-level validation warnings.
- Read-only share links for scope review.
- Publish selected scope events to main catalog.
- LLM event generation from PRD (Vercel AI SDK), with manual review before publish.

### UX and Layout Rules

- Keep current app shell and visual style.
- Keep existing navigation patterns and component language.
- Add one new primary area for planning flow, but avoid a full IA redesign.
- Reuse existing interaction patterns (modals, cards, side panels, toasts, status badges).

### Data Model Additions (SQLite)

Add these tables:

- `tracking_plans`
  - `id`, `name`, `description`, `status` (`draft|ready|published`), `created_at`, `updated_at`.
- `instrumentation_scopes`
  - `id`, `plan_id`, `name`, `status` (`draft|ready|published`), `created_at`, `updated_at`.
- `scope_prd_sources`
  - `id`, `scope_id`, `source_type` (`pasted_text`), `content`, `content_hash`, `created_at`, `updated_at`.
- `scope_events`
  - `id`, `scope_id`, `name`, `description`, `category`, `origin` (`manual|llm`), `confidence`, `rationale`, `is_selected_for_publish`, timestamps.
- `scope_event_properties`
  - mirrors event property structure tied to `scope_events`.
- `scope_validation_runs`
  - cached validation snapshot JSON, warning counts, timestamps.
- `scope_share_links`
  - `id`, `scope_id`, `token`, `is_active`, `expires_at`, timestamps.
- `scope_publish_mappings`
  - `scope_event_id`, `catalog_event_id`, `published_at`.

### API Additions

Create local API routes:

- `GET /api/tracking-plans`
- `POST /api/tracking-plans`
- `GET /api/tracking-plans/:planId`
- `PUT /api/tracking-plans/:planId`
- `GET /api/tracking-plans/:planId/scopes`
- `POST /api/tracking-plans/:planId/scopes`
- `GET /api/scopes/:scopeId`
- `PUT /api/scopes/:scopeId`
- `POST /api/scopes/:scopeId/prd`
- `GET /api/scopes/:scopeId/events`
- `POST /api/scopes/:scopeId/events`
- `PUT /api/scopes/:scopeId/events/:scopeEventId`
- `POST /api/scopes/:scopeId/validate`
- `POST /api/scopes/:scopeId/generate-events`
- `POST /api/scopes/:scopeId/publish`
- `POST /api/scopes/:scopeId/share-links`
- `GET /api/shared/scopes/:token`

### Publish Behavior (Phase 1)

- Publish only selected scope events.
- On publish, always create **new** catalog event records (no merge/resolve).
- Use existing catalog creation/versioning path to preserve changelog consistency.
- Store mapping in `scope_publish_mappings`.

### Validation Policy (Phase 1)

Validation shows warnings and does not block publish.

Checks include:

- Duplicate event names in scope.
- Missing event descriptions.
- Similar property names.
- Missing property data types.
- Conflicting data types for same property name.
- Name/type warnings against existing catalog.

### LLM Event Generation (Vercel AI SDK, Modular)

#### Design Requirements

- Use Vercel AI SDK.
- Keep provider integration modular.
- Keep route layer provider-agnostic.

#### Module Shape

- `EventGenerationProvider` interface.
- `generateFromPrd(input): Promise<GeneratedDraftSet>` contract.
- `OpenAIEventGenerationProvider` implementation using `ai` + `@ai-sdk/openai`.
- `StubEventGenerationProvider` for tests/local fallback.
- Provider factory driven by env (`LLM_PROVIDER`, `OPENAI_API_KEY`, `LLM_MODEL`).

#### Generation Flow

1. Analyst saves PRD text.
2. Analyst clicks `Generate from PRD`.
3. Backend calls provider with strict schema.
4. Response is schema-validated and normalized to allowed enums.
5. Draft scope events are created with `origin=llm`, `confidence`, and `rationale`.
6. Analyst edits/accepts before publish.

### Frontend Additions (No Major Redesign)

Add planning views while preserving current structure:

- `PlansList` page.
- `PlanDetail` page.
- `ScopeWorkspace` page.

Inside `ScopeWorkspace`:

- PRD text panel.
- Draft events list/editor.
- Validation summary panel.
- Actions: `Generate from PRD`, `Validate`, `Share`, `Mark Ready`, `Publish`.

Keep existing catalog tabs (`Events`, `Issues`, `Properties`, `Changelog`, `Import`) unchanged.

### Public Types / Interfaces

Add/extend API contracts:

- `TrackingPlan`, `TrackingPlanCreate`, `TrackingPlanStatus`.
- `InstrumentationScope`, `InstrumentationScopeCreate`, `ScopeStatus`.
- `ScopeEventDraft`, `ScopeEventPropertyDraft`, `ScopeEventOrigin`.
- `ScopeValidationSummary`.
- `ScopeShareLink`.
- `ScopePublishResult`.
- `GenerateEventsRequest`, `GenerateEventsResponse`.

### Phase 1 Test Plan

Backend tests:

- Tracking plan and scope CRUD.
- PRD save/load.
- Scope draft event CRUD.
- Validation endpoint behavior.
- Generation endpoint with stub provider success and error paths.
- Publish creates catalog events + mapping rows.
- Share token read-only retrieval.
- Regression: existing event catalog tests remain green.

Frontend tests:

- Plan/scope load and empty states.
- PRD save interaction.
- Generate action happy/failure path.
- Validation panel rendering.
- Publish flow success/error states.

## Phase 2: Production Hardening (Later)

### Infra and Security

- Add authentication and identity.
- Add role-based access and ownership.
- Move to hosted Postgres.
- Add secure share access model.
- Add rate limiting, security hardening, and observability.

### Workflow Governance

- Add optional review/approval controls.
- Add audit trail for generation and publish decisions.
- Add async job handling for generation retries/timeouts.

### Compatibility Strategy

- Preserve Phase 1 core domain model and route semantics.
- Add auth/policies as middleware around existing routes.
- Keep LLM provider abstraction unchanged so model/provider swaps do not affect route contracts.

## Acceptance Criteria

### Phase 1 Done When

- Single user can create plan and scope, paste PRD, generate drafts, validate, share read-only link, and publish to catalog.
- LLM generation is integrated through modular provider abstraction using Vercel AI SDK.
- Existing catalog workflows remain functional.
- UI remains consistent with current design language and overall layout.

### Phase 2 Done When

- Multi-user production deployment is secure, governed, and observable without changing the core analyst workflow.

## Assumptions and Defaults

- Current stage is POC; breaking changes are acceptable.
- `Instrumentation Scope` is the working name.
- PRD paste is primary ingestion in Phase 1.
- Validation is non-blocking warnings in Phase 1.
- Publish conflict strategy in Phase 1 is always creating new catalog events.
