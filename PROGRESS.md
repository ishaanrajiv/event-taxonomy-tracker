# Event Taxonomy Tracker - Implementation Progress

## Overview
Transforming the event taxonomy tracker from a flat catalog into a team-oriented workflow tool with tracking plans and LLM-powered event generation.

## Technology Stack
- **Backend**: Bun + Hono + SQLite + TypeScript
- **Frontend**: React 19 + Vite + Tailwind CSS + TypeScript
- **LLM**: Vercel AI SDK with Anthropic provider
- **Database**: SQLite with WAL mode (local file)

---

## ✅ Phase 1: Core Tracking Plan CRUD + Routing + Publish Flow (Complete)

### Backend Implementation
- [x] **Database Schema**
  - Added `is_published` column to `events` table (defaults to 1 for backward compatibility)
  - Created `tracking_plans` table (title, description, prd_content, status, share_token, timestamps, approval tracking)
  - Created `tracking_plan_events` junction table (many-to-many relationship with position ordering)

- [x] **TypeScript Types**
  - `TrackingPlanRow`, `TrackingPlanEventRow`
  - `TrackingPlanCreatePayload`, `TrackingPlanUpdatePayload`, `TrackingPlanStatusTransition`
  - `LinkEventPayload`, `ReorderEventsPayload`
  - Status enum: `'draft' | 'in_review' | 'approved' | 'archived'`

- [x] **Validation Module** (`validation-tracking-plans.ts`)
  - `parseTrackingPlanCreatePayload` - Validates plan creation
  - `parseTrackingPlanUpdatePayload` - Validates metadata updates
  - `parseStatusTransition` - Validates status workflow transitions
  - `parseLinkEventPayload`, `parseReorderEventsPayload`

- [x] **Domain Logic** (`domain/tracking-plans.ts`)
  - `createTrackingPlan` - Create new plan
  - `getTrackingPlan`, `listTrackingPlans` - Retrieve plans
  - `updateTrackingPlan` - Update metadata/PRD content
  - `deleteTrackingPlan` - Delete (draft only)
  - `transitionStatus` - Status workflow with validation + publish logic
  - `linkEvent`, `unlinkEvent`, `reorderEvents` - Event management
  - `publishDraftEvents` - Bulk publish on approval
  - `getTrackingPlanEvents` - Fetch events ordered by position

- [x] **API Routes** (11 endpoints)
  ```
  GET    /api/tracking-plans                    - List plans (with status filter)
  POST   /api/tracking-plans                    - Create plan
  GET    /api/tracking-plans/:planId            - Get plan with events
  PUT    /api/tracking-plans/:planId            - Update metadata/PRD
  DELETE /api/tracking-plans/:planId            - Delete (draft only)
  POST   /api/tracking-plans/:planId/status     - Transition status
  POST   /api/tracking-plans/:planId/events     - Link existing event
  POST   /api/tracking-plans/:planId/events/create - Create draft event + link
  DELETE /api/tracking-plans/:planId/events/:eventId - Unlink event
  PUT    /api/tracking-plans/:planId/events/reorder - Reorder events
  GET    /api/share/:shareToken                 - Public read-only view (placeholder)
  ```

- [x] **Event Creation Updates**
  - Modified `createEventVersioned` to accept optional `is_published` parameter
  - Defaults to `1` (published) for backward compatibility
  - Tracking plan events created with `is_published = 0` (draft)
  - Updated `GET /api/events` to filter by `is_published = 1` by default

### Frontend Implementation
- [x] **TypeScript Types** (`types/api.ts`)
  - `TrackingPlan`, `TrackingPlanSummary`
  - `TrackingPlanCreate`, `TrackingPlanUpdate`
  - `StatusTransition`, `LinkEventRequest`, `ReorderEventsRequest`

- [x] **Navigation**
  - Added "Tracking Plans" tab to main navigation (between Events and Issues)
  - Tab-based navigation (no React Router in Phase 1)
  - `selectedPlanId` state for drill-down navigation

- [x] **TrackingPlanList Component**
  - List view with status badges (Draft, In Review, Approved, Archived)
  - Status filter buttons (All, Draft, In Review, Approved, Archived)
  - Create new plan button
  - Plan cards showing: title, description, event count, creation date, creator
  - Click to open workspace

- [x] **TrackingPlanWorkspace Component**
  - Header with back button, editable title, status badge
  - Status action dropdown (Submit for Review, Approve & Publish, Return to Draft, Archive, Delete)
  - PRD content panel (collapsible)
  - Events list panel
  - Status-dependent UI (editing disabled when approved/archived)

- [x] **PrdPanel Component**
  - Collapsible panel for PRD content
  - Textarea editor with auto-save on blur
  - Read-only view when plan is approved/archived
  - Character count indicator
  - Unsaved changes indicator with manual save button

- [x] **PlanEventList Component**
  - Events list with "Add Event" and "Link Existing" buttons
  - Empty state with call-to-action
  - Integration with EventModal for creating draft events
  - Integration with LinkEventDialog for linking published events

- [x] **PlanEventCard Component**
  - Expandable event cards (reuses EventList styling patterns)
  - Shows event name, category, description, property count, version
  - "Draft" badge for unpublished events
  - Expandable properties table
  - Remove from plan action (with confirmation)

- [x] **LinkEventDialog Component**
  - Modal dialog for searching and linking existing published events
  - Search by event name/description
  - Multi-select with checkboxes
  - Filters out events already in the plan
  - Bulk link selected events

- [x] **EventModal Updates**
  - Added optional `trackingPlanId` prop
  - When creating events within a plan, uses `/tracking-plans/:id/events/create` endpoint
  - Creates draft events automatically (is_published = 0)

### Status Workflow
```
draft → in_review → approved → archived
  │         │
  └─────────┘
  (can return to draft from in_review)
```

- **Draft**: Editable, no share link, can delete
- **In Review**: Editable, share link generated, can approve or return to draft
- **Approved**: Read-only, events published to catalog (`is_published = 1`), can archive
- **Archived**: Read-only, events stay published

### Key Design Decisions
1. **Publish on Approval**: Events are draft until plan is approved, then bulk published
2. **Junction Table**: Events can belong to multiple plans, tracked via `tracking_plan_events`
3. **Backward Compatible**: All existing events have `is_published = 1` by default
4. **No Router Refactor**: Kept tab-based navigation, avoided React Router complexity for Phase 1
5. **Draft Events Hidden**: Main catalog only shows published events by default

---

## 🚧 Phase 2: Sharing + Workflow States (Deferred)

- [ ] Share link UI with copy button
- [ ] Public share page (`/share/:shareToken`) with read-only view
- [ ] React Router implementation for shareable URLs
- [ ] Share link only active for `in_review` and `approved` status

---

## ✅ Phase 3: LLM Event Generation (Complete)

### Backend
- [x] **Install Vercel AI SDK packages** (`ai`, `@ai-sdk/anthropic`)
  - Installed via Bun: `ai@4.2.17` and `@ai-sdk/anthropic@1.0.11`

- [x] **LLM Module** (`apps/api/src/llm/`)
  - `provider.ts` - Anthropic provider factory using Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
  - `types.ts` - Zod schemas for structured output validation (`PropertySchema`, `SuggestedEventSchema`, `GeneratedEventsSchema`)
  - `generate.ts` - Event generation function with deduplication logic
  - `prompt.ts` - Dynamic prompt builder with context injection
  - `guidelines.md` - **Editable markdown file** with LLM guidelines (naming conventions, property types, best practices)

- [x] **API Endpoint**
  - `POST /api/tracking-plans/:planId/generate` - Generate events from PRD
  - Returns: `{ suggested_events: SuggestedEvent[], usage: { promptTokens, completionTokens, totalTokens } }`
  - Validates PRD content exists before generation
  - Uses Vercel AI SDK's `generateObject()` for structured output

- [x] **Environment Configuration**
  - `ANTHROPIC_API_KEY` required in environment
  - SDK automatically reads from environment variable

### Frontend
- [x] **GenerateEventsPanel Component**
  - Modal dialog with gradient "Generate" button
  - Loading state with spinner during generation
  - Displays suggested events with checkboxes
  - Auto-selects non-duplicate events
  - Shows duplicate warnings with orange badges
  - Event cards with name, description, category, reasoning, properties
  - Expandable property details
  - Token usage stats display (prompt/completion/total)
  - Regenerate button for new suggestions
  - "Accept Selected" bulk action

- [x] **PlanEventList Integration**
  - Added gradient "Generate" button in toolbar
  - Opens GenerateEventsPanel modal
  - `handleAcceptGeneratedEvents` creates events in parallel via API
  - Success message with event count

### LLM Prompt Context
The prompt builder (`buildGenerationPrompt`) includes:

1. **Guidelines** (from `guidelines.md`)
   - Event naming: Title Case (e.g., "Checkout Started")
   - Property naming: **Title Case** (e.g., "Cart ID", "User Email")
   - Property types: event/user/super with examples
   - Data types: String/Int/Float/Boolean/List/JSON with usage
   - Best practices: reuse, required vs optional, duplicate detection

2. **Existing Events** (up to 100 most recent)
   - Used for duplicate detection
   - Format: `"Event Name" (category): description`

3. **Property Registry** (all distinct properties)
   - Used for property reuse
   - Format: `property_name (data_type)`

4. **10 Random Example Events** (with properties)
   - Provides broader context for quality and structure
   - Shows realistic event/property patterns
   - Fetched using `ORDER BY RANDOM() LIMIT 10`

5. **PRD Content**
   - User-provided product requirements

6. **Plan Context**
   - Tracking plan title

### LLM Model
- **Model**: Claude Sonnet 4.5 (`claude-sonnet-4-20250514`)
- **Provider**: Anthropic via Vercel AI SDK
- **Output Format**: Structured JSON with Zod schema validation

### Property Naming Convention
**Important**: Property names use **Title Case**, not snake_case:
- ✅ `User ID`, `Cart Total`, `Is Premium Member`
- ❌ `user_id`, `cart_total`, `is_premium_member`

This applies to:
- LLM-generated events
- Manually created events
- Property registry
- All documentation and examples

---

## 📋 Phase 4: Per-Plan Validation (Not Started)

- [ ] `GET /api/tracking-plans/:planId/validation` endpoint
- [ ] `PlanValidation` component (reuses `trackingValidation.ts`)
- [ ] Collapsible validation panel in workspace
- [ ] Scoped validation checks (only for plan's events)

---

## 🔮 Future Enhancements (Out of Scope)

- User authentication and authorization
- Real user management (currently hardcoded `user@example.com`)
- Remote/hosted database (currently local SQLite)
- File upload for PRDs (PDF/DOCX parsing)
- Real-time collaboration on plans
- Comments/annotations on plans and events
- Plan change history / audit trail
- Export plan as document (PDF/Confluence)
- Multiple LLM provider switcher UI
- Streaming LLM responses
- Cost tracking for LLM usage

---

## Database Schema

### Modified Tables
```sql
-- Added to existing events table
ALTER TABLE events ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;
```

### New Tables
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

CREATE TABLE tracking_plan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_plan_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  added_by TEXT,
  FOREIGN KEY(tracking_plan_id) REFERENCES tracking_plans(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(tracking_plan_id, event_id)
);
```

---

## Testing Notes

- Database recreated successfully with new schema
- Backend typechecks pass
- Frontend typechecks pass
- API server starts without errors
- All 11 tracking plan endpoints functional
- Event creation, linking, unlinking tested
- Status transitions working correctly
- Draft events properly hidden from main catalog
- Publish flow (approve → bulk publish) working

---

## Next Steps

1. **Complete Phase 3**: LLM event generation with Vercel AI SDK
2. **Complete Phase 4**: Per-plan validation
3. **Testing**: End-to-end workflow testing with real PRDs
4. **Phase 2**: Share functionality with routing (if needed)
