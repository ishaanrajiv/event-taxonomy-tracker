# Event Taxonomy Tool

A weekend POC for managing analytics event taxonomies with property registry, conflict detection, and automatic changelog.

## Security Notice

**This is a proof-of-concept tool intended for development and learning purposes.**

For production deployment, you must implement:
- ✅ **Authentication and authorization** - Currently has no access control
- ✅ **CORS configuration** - Currently allows all localhost origins
- ✅ **Production database** - Use PostgreSQL instead of SQLite
- ✅ **Rate limiting** - Protect against abuse
- ✅ **Input validation** - Add field length limits and sanitization
- ✅ **HTTPS/TLS** - Secure transport layer
- ✅ **Security headers** - CSP, HSTS, etc.
- ✅ **Logging and monitoring** - Track security events

**Do not deploy this POC to production without implementing proper security measures.**

## Features

- **Event Management**: Create, edit, and delete analytics events
- **Property Registry**: Centralized registry of all unique properties with data type enforcement
- **Conflict Detection**: Prevents property redefinition with different data types
- **Fuzzy Search**: Suggests similar property names to prevent duplicates
- **Automatic Changelog**: Full audit trail of all changes
- **Search & Filter**: Find events by name or description

## Tech Stack

**Backend:**
- FastAPI (Python)
- SQLite database
- SQLAlchemy ORM
- Managed with `uv`

**Frontend:**
- React + Vite
- Tailwind CSS
- Axios for API calls

## Quick Start

```bash
# Install dependencies
uv sync
npm install --prefix frontend

# Run both servers (easiest method)
./run.sh

# Or run manually in separate terminals:
# Terminal 1 - Backend
uv run uvicorn api:app --reload --port 8000

# Terminal 2 - Frontend
npm run dev --prefix frontend
```

Then visit:
- **Frontend**: http://localhost:5173
- **Backend API Docs**: http://localhost:8000/docs

## Usage

### Creating an Event

1. Click "New Event" button
2. Fill in event details (name, description, category)
3. Add properties:
   - Type a property name - the system will suggest similar existing properties
   - Select property type (event, user, or super)
   - Choose data type (String, Int, Float, Boolean, List, JSON)
   - Mark as required if needed
   - Add example value
4. Click "Create Event"

### Property Conflict Detection

The system enforces data type consistency. If you try to create a property with a name that already exists but with a different data type, you'll get an error:

```
❌ Property 'user_id' already exists with data type 'String'.
   Cannot redefine as 'Int'.
```

This ensures consistency across your entire event taxonomy.

### Fuzzy Search

When typing a property name, the system automatically searches for similar existing properties and suggests them with similarity scores. This helps prevent creating duplicate properties with slightly different names (e.g., `user_id`, `userId`, `user-id`).

### Changelog

Switch to the "Changelog" tab to see a full audit trail of all changes:
- Event creation, updates, and deletions
- Property additions
- Who made the change and when
- Before/after values for updates

## API Endpoints

### Events
- `GET /api/events` - List all events (with optional search query)
- `POST /api/events` - Create new event
- `GET /api/events/{id}` - Get single event
- `PUT /api/events/{id}` - Update event
- `DELETE /api/events/{id}` - Delete event

### Properties
- `GET /api/properties` - List all properties
- `POST /api/properties` - Create new property
- `GET /api/properties/suggest?q=<name>` - Get fuzzy match suggestions

### Changelog
- `GET /api/changelog` - Get recent changes
- `GET /api/changelog?entity_type=event&entity_id=123` - Filter by entity

## Project Structure

```
event-taxonomy-tool/
├── api.py              # FastAPI application and endpoints
├── database.py         # SQLAlchemy models and database setup
├── models.py           # Pydantic models for API validation
├── utils.py            # Utility functions (fuzzy search)
├── seed_data.py        # Sample data seeder (optional)
├── pyproject.toml      # Python dependencies (managed by uv)
├── run.sh              # Convenience script to start both servers
├── frontend/
│   ├── src/
│   │   ├── App.jsx                    # Main app component
│   │   ├── components/
│   │   │   ├── EventList.jsx          # Event list with expandable rows
│   │   │   ├── EventModal.jsx         # Create/edit event modal
│   │   │   ├── PropertyRegistry.jsx   # Property registry view
│   │   │   └── Changelog.jsx          # Changelog view
│   │   └── index.css                  # Tailwind CSS
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```

## Example API Calls

### Create an Event

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Button Clicked",
    "description": "User clicks a button",
    "category": "Engagement",
    "properties": [
      {
        "property_name": "button_id",
        "property_type": "event",
        "data_type": "String",
        "is_required": true,
        "example_value": "cta-signup"
      }
    ]
  }'
```

### Search for Similar Properties

```bash
curl "http://localhost:8000/api/properties/suggest?q=user"
```

Response:
```json
{
  "query": "user",
  "suggestions": [
    {
      "name": "user_id",
      "data_type": "String",
      "similarity": 0.727
    }
  ]
}
```

## Development Notes

### What's Included in POC

✅ Event + Property management with normalized model  
✅ Property registry with type enforcement  
✅ Similar name suggestions (fuzzy matching)  
✅ Conflict detection (same property name, different data type)  
✅ Full changelog (automatic)  
✅ Search/filter  
✅ Simple UI with Tailwind CSS  

### Out of Scope for POC

The following features were intentionally left out but could be added:

- Code snippet generation (SDK integration samples)
- Granular permissions/roles (currently open access)
- Google Sheets import/export
- Status workflow (draft, approved, etc.)
- User authentication (uses placeholder user emails)
- Production deployment configuration

### Database

The POC uses SQLite for simplicity. For production:
1. Update the connection string in `database.py` to use PostgreSQL
2. Install `psycopg2` or `asyncpg`
3. Update the `SQLALCHEMY_DATABASE_URL`

## License

MIT
