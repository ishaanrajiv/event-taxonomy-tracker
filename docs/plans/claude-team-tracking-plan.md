# Tracking Plan Workflow: Team-Oriented Event Taxonomy Tracker

## Context

The app is currently a flat event catalog (add/edit/archive events). The real-world workflow is: Product writes a PRD → Analyst manually creates events in spreadsheets → links back to PRD. We're building the tool that replaces that spreadsheet step, with the end goal of automating event generation via LLM from PRDs.

**Scope:** Single-user, local SQLite, no auth/roles. All features (tracking plans, LLM generation, sharing, validation) are included. Keep current UI design language and layout — no major UI restructuring.

## Conceptual Model

**"Tracking Plan"** is the new first-class entity — a batch of related events tied to a specific feature/PRD.

```
Event Catalog (the full published event taxonomy — what exists today)
  └── Tracking Plan (a workspace tied to one PRD/feature)
        ├── PRD Content (pasted markdown/text)
        ├── Events (draft until plan is approved, then published to catalog)
        └── Validation (scoped checks)
```

**Publish on approval.** Events created within a Tracking Plan are draft (hidden from main catalog). On approval, they publish to the catalog.

## Tracking Plan Workflow States

```
draft → in_review → approved
  │         │
  └─────────┴──→ archived
```

| State | Editable? | Share Link? | Events Published? |
|-------|-----------|-------------|-------------------|
| `draft` | Yes | No | No (draft) |
| `in_review` | Yes | Yes | No (draft) |
| `approved` | No (frozen) | Yes | **Yes (published)** |
| `archived` | No | No | Stay published |

## Data Model Changes

### Modify: `events` table — add `is_published` column
```sql
ALTER TABLE events ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;
```
- Default `1` — all existing events stay published (backward compatible)
- Events created through a tracking plan start as `is_published = 0`
- On plan approval, bulk update to `is_published = 1`

### New: `tracking_plans` table
```sql
CREATE TABLE tracking_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  prd_content TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  share_token TEXT UNIQUE,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  archived_at TEXT,
  archived_by TEXT
);
CREATE INDEX idx_tracking_plans_status ON tracking_plans(status);
CREATE INDEX idx_tracking_plans_share_token ON tracking_plans(share_token);
```

### New: `tracking_plan_events` junction table
```sql
CREATE TABLE tracking_plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_plan_id INTEGER NOT NULL REFERENCES tracking_plans(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  added_by TEXT,
  UNIQUE(tracking_plan_id, event_id)
);
CREATE INDEX idx_tpe_plan_id ON tracking_plan_events(tracking_plan_id);
CREATE INDEX idx_tpe_event_id ON tracking_plan_events(event_id);
```

## API Design

### New Tracking Plan Routes
```
GET    /api/tracking-plans                              -- List plans (filter by status)
POST   /api/tracking-plans                              -- Create plan
GET    /api/tracking-plans/:planId                      -- Get plan with events
PUT    /api/tracking-plans/:planId                      -- Update metadata/PRD
DELETE /api/tracking-plans/:planId                      -- Delete (draft only)
POST   /api/tracking-plans/:planId/status               -- Transition status
POST   /api/tracking-plans/:planId/events               -- Link existing catalog event
POST   /api/tracking-plans/:planId/events/create        -- Create draft event + link
DELETE /api/tracking-plans/:planId/events/:eventId      -- Unlink event from plan
PUT    /api/tracking-plans/:planId/events/reorder       -- Reorder events
GET    /api/tracking-plans/:planId/validation            -- Scoped validation
POST   /api/tracking-plans/:planId/generate              -- LLM generation from PRD
GET    /api/share/:shareToken                            -- Public read-only view
```

### Status transition logic
- `draft` → `in_review`: Generate `share_token` if not exists
- `in_review` → `approved`: **Publish all draft events** in this plan
- `in_review` → `draft`: Send back for revisions
- `approved` → `archived`: Events stay published
- `draft` → `archived`: Draft events stay unpublished

### Changes to existing endpoints
- `GET /api/events` — filter `is_published = 1` by default, add optional `tracking_plan_id` param
- `POST /api/events` — stays `is_published = 1` (backward compatible)

## Frontend Architecture

### No router refactor — keep tab-based SPA
Add **"Tracking Plans"** as a new tab alongside Events, Issues, Properties, Changelog, Import. The existing tab system and `App.tsx` structure stays intact.

**Tracking Plans tab** shows a list view. Clicking a plan opens a **detail/workspace view** (replaces list content, with a back button — same pattern as drilling into any list item). This avoids React Router, page files, and the App.tsx refactor entirely.

### New state in App.tsx
```typescript
// Alongside existing activeTab state:
const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
```
When `activeTab === 'tracking-plans'`:
- If `selectedPlanId` is null → show TrackingPlanList
- If `selectedPlanId` is set → show TrackingPlanWorkspace

### Tracking Plan Workspace Layout
Rendered inline within the existing tab content area. Uses the same card/panel styles as the rest of the app.

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Plans    Plan Title          [Draft ▾] [Share] ... │
├──────────────────────────────────────────────────────────────┤
│ PRD Content                                                   │
│ (collapsible textarea — paste/edit markdown)                  │
├──────────────────────────────────────────────────────────────┤
│ Events                    [+ Add Event] [+ Link] [⚡ Generate] │
│ ┌─ Event Card (expandable, same style as EventList) ────────┐ │
│ │  Event Name       [Draft]           [Edit] [Remove] [▼]   │ │
│ │  (expanded: properties table, description)                 │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ Event Card ──────────────────────────────────────────────┐ │
│ │  ...                                                       │ │
│ └────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Validation (collapsible) — scoped issues for this plan        │
└──────────────────────────────────────────────────────────────┘
```

### New Components
```
components/tracking-plan/
  TrackingPlanList.tsx          — List of plans with status badges, event counts
  TrackingPlanWorkspace.tsx     — Detail view: header + PRD + events + validation
  PrdPanel.tsx                  — Collapsible textarea for PRD content
  PlanEventList.tsx             — Events within plan (reuses EventList card styles)
  PlanEventCard.tsx             — Single event card with remove/edit actions
  LinkEventDialog.tsx           — Search + link existing published catalog events
  GenerateEventsPanel.tsx       — LLM suggestions with accept/reject/edit
  ShareDialog.tsx               — Copy share URL
  PlanValidation.tsx            — Scoped validation (reuses trackingValidation.ts)
```

### Reuse existing components
- **EventModal** — used as-is for creating/editing events within a plan (pass a callback to also link to plan)
- **EventList card styles** — PlanEventCard reuses the same expandable card pattern
- **IssuesPanel logic** — PlanValidation reuses `trackingValidation.ts` utilities
- **Toast** — used for all notifications
- **FilterBar patterns** — status filter on plan list

## LLM Integration (Vercel AI SDK)

### Why Vercel AI SDK
- Provider-agnostic: swap between Anthropic, OpenAI, etc. via config
- Streaming support out of the box
- Structured output helpers (for JSON event schemas)
- Modular — provider is a config choice, not a code change

### Backend dependencies (`apps/api`)
```
ai                    — Core Vercel AI SDK
@ai-sdk/anthropic     — Anthropic provider (default)
```

Optionally add `@ai-sdk/openai` later without changing generation logic.

### Backend files
```
apps/api/src/llm/
  provider.ts    — Provider factory (reads env, returns configured provider)
  prompt.ts      — Prompt builder (PRD + context → system/user messages)
  generate.ts    — generateObject() call, returns typed SuggestedEvent[]
  types.ts       — SuggestedEvent schema (Zod for structured output)
```

### Provider configuration (`provider.ts`)
```typescript
import { anthropic } from '@ai-sdk/anthropic';
// Reads ANTHROPIC_API_KEY from env automatically
// Export a function that returns the model instance
export function getModel() {
  return anthropic('claude-sonnet-4-20250514');
}
```

Swapping to OpenAI later = change this one file + env var.

### Generation logic (`generate.ts`)
Use `generateObject()` from `ai` with a Zod schema for structured output:
```typescript
import { generateObject } from 'ai';
import { z } from 'zod';

const SuggestedEventSchema = z.object({
  events: z.array(z.object({
    name: z.string(),
    description: z.string(),
    category: z.string().nullable(),
    reasoning: z.string(),
    duplicate_of_name: z.string().nullable(),
    properties: z.array(z.object({
      property_name: z.string(),
      property_type: z.enum(['event', 'user', 'super']),
      data_type: z.enum(['String', 'Int', 'Float', 'Boolean', 'List', 'JSON']),
      is_required: z.boolean(),
      example_value: z.string().nullable(),
      description: z.string().nullable(),
    })),
  })),
});
```

### Prompt context includes
1. PRD content from the tracking plan
2. All published events in catalog (for duplicate detection)
3. Property registry (for reuse)
4. Naming conventions (Title Case events, snake_case properties)

### Review UX (GenerateEventsPanel)
LLM returns suggestions (not persisted). Rendered inline in the workspace:
- Each suggestion as a card: name, description, properties, reasoning
- Duplicate warning if similar to existing event
- Actions per card: **Accept** (creates draft event), **Edit** (opens EventModal pre-filled), **Reject**
- Bulk "Accept All" button

### Env vars
```
ANTHROPIC_API_KEY=sk-ant-...
# Optional future:
# OPENAI_API_KEY=sk-...
# LLM_PROVIDER=anthropic|openai
```

## Implementation Phases

### Phase 1: Tracking Plan CRUD + Events (~50%)
**Backend:**
1. Add `is_published` column + new tables in `apps/api/src/db.ts`
2. Add types in `apps/api/src/types.ts`
3. Create `apps/api/src/validation-tracking-plans.ts`
4. Create `apps/api/src/domain/tracking-plans.ts` (CRUD, link/unlink events, status transitions, publish)
5. Add routes in `apps/api/src/app.ts`
6. Update `GET /api/events` to default `is_published = 1`

**Frontend:**
1. Add "Tracking Plans" tab in `App.tsx`
2. Create `TrackingPlanList.tsx` — list with status filter
3. Create `TrackingPlanWorkspace.tsx` — detail view
4. Create `PrdPanel.tsx` — PRD textarea
5. Create `PlanEventList.tsx` + `PlanEventCard.tsx` — events within plan
6. Create `LinkEventDialog.tsx` — link existing events
7. Wire EventModal for creating events within a plan
8. Add tracking plan types to `types/api.ts`

### Phase 2: Status Workflow + Sharing (~15%)
- Status transition buttons in workspace header
- Publish events on approval
- Share token generation + `GET /api/share/:shareToken`
- `ShareDialog.tsx` — copy link
- Status-dependent UI (disable editing when approved)

### Phase 3: LLM Generation (~25%)
- `bun add ai @ai-sdk/anthropic zod` in apps/api
- Create `apps/api/src/llm/` module (provider, prompt, generate, types)
- `POST /api/tracking-plans/:planId/generate` endpoint
- Create `GenerateEventsPanel.tsx`
- Accept/reject/edit flow wired to event creation

### Phase 4: Per-Plan Validation (~10%)
- `GET /api/tracking-plans/:planId/validation` endpoint
- `PlanValidation.tsx` (reuses `trackingValidation.ts`)
- Collapsible panel in workspace

## Key Files to Modify
- `apps/api/src/db.ts` — Add tables + `is_published` migration
- `apps/api/src/types.ts` — Add tracking plan types
- `apps/api/src/app.ts` — Add tracking plan routes, update events filter
- `apps/api/src/domain/versioning.ts` — Accept `is_published` param in `createEventVersioned`
- `apps/frontend/src/App.tsx` — Add tracking plans tab + selectedPlanId state
- `apps/frontend/src/types/api.ts` — Add tracking plan types

## Key Files to Create
- `apps/api/src/domain/tracking-plans.ts`
- `apps/api/src/validation-tracking-plans.ts`
- `apps/api/src/llm/provider.ts`, `prompt.ts`, `generate.ts`, `types.ts`
- `apps/frontend/src/components/tracking-plan/TrackingPlanList.tsx`
- `apps/frontend/src/components/tracking-plan/TrackingPlanWorkspace.tsx`
- `apps/frontend/src/components/tracking-plan/PrdPanel.tsx`
- `apps/frontend/src/components/tracking-plan/PlanEventList.tsx`
- `apps/frontend/src/components/tracking-plan/PlanEventCard.tsx`
- `apps/frontend/src/components/tracking-plan/LinkEventDialog.tsx`
- `apps/frontend/src/components/tracking-plan/GenerateEventsPanel.tsx`
- `apps/frontend/src/components/tracking-plan/ShareDialog.tsx`
- `apps/frontend/src/components/tracking-plan/PlanValidation.tsx`

## Deferred (future, not in scope)
- Auth, user roles, permissions
- Remote/hosted database
- React Router (add when shareable URLs are needed beyond share tokens)
- File upload for PRDs (PDF/DOCX parsing)
- Real-time collaboration
- Comments/annotations on plans
- Multiple LLM provider UI switcher

## Verification
1. Create a tracking plan, paste PRD, add events → verify events are **draft** (not in main catalog)
2. Approve the plan → verify events become **published** (appear in catalog)
3. Existing events remain visible (`is_published` defaults to 1)
4. Share a plan → copy share token link
5. Generate events from PRD via LLM → accept/reject works, creates draft events
6. Validation panel shows scoped issues for plan events
7. Link an existing published event to a plan → stays published
