Event Taxonomy Tracker - POC Plan
Perfect, this scopes nicely for a weekend POC. Let me think through the simplest thing that could work.

POC Scope (Weekend-sized)
In Scope:

Event + Property management with the normalized model
Property registry with type enforcement
Similar name suggestions (fuzzy matching)
Conflict detection (same property name + type, different data type)
Full changelog (automatic)
Search/filter
Simple auth (Google OAuth, no complex roles for POC)

Out of Scope for POC:

Code snippet generation
Granular permissions (everyone can edit for now)
Import from Google Sheets (manual entry or seed script)
Status workflow


Tech Stack (Optimized for speed)
Frontend:  React + Vite + TanStack Table + Tailwind
Backend:   FastAPI (Python) - fast to write, good for data work
Database:  SQLite for POC (swap to Postgres later)
Auth:      NextAuth or simple JWT (or skip entirely for POC?)
Alternative consideration: Should we skip auth entirely for the POC and run it locally/internally? That saves 2-3 hours. Add auth in v2 when you deploy properly.

Data Model (Simplified)
sql-- Property Registry (source of truth for property definitions)
CREATE TABLE properties (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,          -- e.g., "user_id"
    data_type TEXT NOT NULL,            -- Float, Int, String, List, JSON
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW,
    created_by TEXT
);

-- Events
CREATE TABLE events (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,                 -- e.g., "Content Shared"
    description TEXT,
    category TEXT,                      -- optional grouping
    created_at TIMESTAMP DEFAULT NOW,
    updated_at TIMESTAMP DEFAULT NOW,
    created_by TEXT
);

-- Event-Property associations
CREATE TABLE event_properties (
    id INTEGER PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    property_id INTEGER REFERENCES properties(id),
    property_type TEXT NOT NULL,        -- 'event', 'user', 'super'
    is_required BOOLEAN DEFAULT FALSE,
    example_value TEXT,
    UNIQUE(event_id, property_id, property_type)
);

-- Changelog (automatic audit trail)
CREATE TABLE changelog (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,          -- 'event', 'property', 'event_property'
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,               -- 'create', 'update', 'delete'
    old_value JSON,
    new_value JSON,
    changed_by TEXT,
    changed_at TIMESTAMP DEFAULT NOW
);
```

---

## Key Flows

**1. Adding a Property to an Event**
```
User types property name "user_id"
    │
    ▼
System searches property registry
    │
    ├─► Found exact match → Use existing property
    │                       (inherits data_type)
    │
    ├─► Found similar names → Show suggestions
    │   ("user_ID", "userId", "user-id")
    │   User picks one OR creates new
    │
    └─► No match → Create new property
                   User specifies data_type
```

**2. Conflict Detection**
```
User tries to create property "user_id" as Integer
    │
    ▼
System checks: "user_id" already exists as String
    │
    └─► ERROR: "Property 'user_id' already exists 
        with data type 'String'. Cannot redefine."
```

**3. Changelog (Automatic)**

Every create/update/delete writes to changelog with before/after state. No user action needed.

---

## UI Sketch (Minimal)
```
┌────────────────────────────────────────────────────────────────┐
│  Event Taxonomy Manager                        [Search: ____]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  [+ New Event]  [Property Registry]  [Changelog]               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Events (247)                          Filter by category ▼│  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ▶ Content Shared                              Engagement  │  │
│  │   "User shares content to external platform"              │  │
│  │   Properties: content_id (String), share_method (String)  │  │
│  │                                                           │  │
│  │ ▶ Screen Viewed                               Navigation  │  │
│  │   "User views a screen"                                   │  │
│  │   Properties: screen_name (String), referrer (String)     │  │
│  │                                                           │  │
│  │ ▶ Purchase Completed                          Transaction │  │
│  │   ...                                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘

Expanded Event View:
┌──────────────────────────────────────────────────────────────┐
│ ▼ Content Shared                              [Edit] [Delete]│
│   "User shares content to external platform"                 │
│   Category: Engagement                                       │
│                                                              │
│   Properties:                                [+ Add Property]│
│   ┌────────────┬──────────┬───────────┬──────────┬────────┐ │
│   │ Name       │ Type     │ Data Type │ Required │ Example│ │
│   ├────────────┼──────────┼───────────┼──────────┼────────┤ │
│   │ content_id │ event    │ String    │ Yes      │ "abc1" │ │
│   │ share_type │ event    │ String    │ Yes      │ "copy" │ │
│   │ user_id    │ user     │ String    │ No       │ "u123" │ │
│   └────────────┴──────────┴───────────┴──────────┴────────┘ │
│                                                              │
│   Last modified: 2 hours ago by alice@company.com            │
└──────────────────────────────────────────────────────────────┘

API Endpoints (FastAPI)
python# Events
GET    /api/events              # List all (with search/filter)
POST   /api/events              # Create event
GET    /api/events/{id}         # Get single event with properties
PUT    /api/events/{id}         # Update event
DELETE /api/events/{id}         # Delete event

# Event Properties
POST   /api/events/{id}/properties     # Add property to event
DELETE /api/events/{id}/properties/{prop_id}  # Remove property

# Property Registry
GET    /api/properties          # List all properties
POST   /api/properties          # Create new property
GET    /api/properties/suggest?q=user  # Fuzzy search for suggestions

# Changelog
GET    /api/changelog           # List recent changes
GET    /api/changelog?entity_type=event&entity_id=123  # Filter

# Search
GET    /api/search?q=content    # Global search across events + properties

Fuzzy Matching Strategy
For "similar name" suggestions, simple approach:
pythonfrom difflib import SequenceMatcher

def find_similar_properties(query: str, existing: list[str], threshold=0.6):
    suggestions = []
    for name in existing:
        ratio = SequenceMatcher(None, query.lower(), name.lower()).ratio()
        if ratio > threshold and query.lower() != name.lower():
            suggestions.append((name, ratio))
    return sorted(suggestions, key=lambda x: -x[1])[:5]

# "user_id" → might suggest ["userId", "user_ID", "userid"]
Can upgrade to Levenshtein distance or trigram search later.

Build Order (Weekend Plan)
Saturday Morning (3-4 hrs): Backend

Set up FastAPI project structure
SQLite + SQLAlchemy models
CRUD endpoints for events and properties
Changelog middleware (auto-log all changes)
Fuzzy search endpoint

Saturday Afternoon (3-4 hrs): Frontend Shell

Vite + React + Tailwind setup
Event list view with expandable rows
Basic search/filter

Sunday Morning (3-4 hrs): Core Interactions

Create/edit event modal
Add property flow with suggestions
Property conflict detection UI

Sunday Afternoon (2-3 hrs): Polish

Changelog view
Property registry page
Bug fixes, edge cases


Questions Before We Build

Auth for POC: Skip entirely and run locally? Or minimal Google OAuth from day one?
Deployment: Local only for now, or want to deploy somewhere (Fly.io, Railway) so team can see it?
Seed Data: Want me to include a script to seed ~20 sample events so you're not starting empty?
Any categories you already use to group events? (e.g., Engagement, Navigation, Transaction, etc.)


Ready to start coding when you give the go-ahead. I'd suggest we build backend first, test with curl/Postman, then layer the UI on top. Sound good?