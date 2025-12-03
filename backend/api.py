from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import csv
import io

from database import get_db, init_db, Event, Property, EventProperty, Changelog
from models import (
    EventCreate, EventResponse, EventUpdate,
    PropertyCreate, PropertyResponse,
    EventPropertyCreate,
    ChangelogResponse
)
from utils import find_similar_properties

app = FastAPI(title="Event Taxonomy Tool")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


def log_change(db: Session, entity_type: str, entity_id: int, action: str,
               old_value: dict = None, new_value: dict = None, changed_by: str = None):
    """Helper function to log changes to changelog."""
    changelog = Changelog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        changed_by=changed_by
    )
    db.add(changelog)
    db.commit()


# ========== EVENT ENDPOINTS ==========

@app.get("/api/events", response_model=List[EventResponse])
def list_events(
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all events with optional search and category filter."""
    query = db.query(Event)

    if q:
        query = query.filter(
            (Event.name.ilike(f"%{q}%")) | (Event.description.ilike(f"%{q}%"))
        )

    if category:
        query = query.filter(Event.category == category)

    events = query.all()

    # Format response with properties
    result = []
    for event in events:
        event_dict = {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "category": event.category,
            "created_by": event.created_by,
            "created_at": event.created_at,
            "updated_at": event.updated_at,
            "properties": []
        }

        for ep in event.event_properties:
            event_dict["properties"].append({
                "id": ep.id,
                "property_id": ep.property_id,
                "property_name": ep.property.name,
                "property_type": ep.property_type,
                "data_type": ep.property.data_type,
                "description": ep.property.description,
                "is_required": ep.is_required,
                "example_value": ep.example_value
            })

        result.append(event_dict)

    return result


@app.post("/api/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """Create a new event with properties."""
    # Create event
    db_event = Event(
        name=event.name,
        description=event.description,
        category=event.category,
        created_by=event.created_by
    )
    db.add(db_event)
    db.flush()

    # Add properties
    for prop_create in event.properties:
        # Check if property exists
        property_obj = db.query(Property).filter(Property.name == prop_create.property_name).first()

        if property_obj:
            # Verify data type matches
            if property_obj.data_type != prop_create.data_type:
                raise HTTPException(
                    status_code=400,
                    detail=f"Property '{prop_create.property_name}' already exists with data type '{property_obj.data_type}'. Cannot redefine as '{prop_create.data_type}'."
                )
        else:
            # Create new property
            property_obj = Property(
                name=prop_create.property_name,
                data_type=prop_create.data_type,
                description=prop_create.description,
                created_by=event.created_by
            )
            db.add(property_obj)
            db.flush()

            # Log property creation
            log_change(
                db, "property", property_obj.id, "create",
                new_value={"name": property_obj.name, "data_type": property_obj.data_type},
                changed_by=event.created_by
            )

        # Create event-property association
        event_property = EventProperty(
            event_id=db_event.id,
            property_id=property_obj.id,
            property_type=prop_create.property_type,
            is_required=prop_create.is_required,
            example_value=prop_create.example_value
        )
        db.add(event_property)

    db.commit()
    db.refresh(db_event)

    # Log event creation
    log_change(
        db, "event", db_event.id, "create",
        new_value={"name": db_event.name, "description": db_event.description, "category": db_event.category},
        changed_by=event.created_by
    )

    # Return formatted response
    events = list_events(db=db)
    return next((e for e in events if e["id"] == db_event.id), events[0] if events else db_event)


@app.get("/api/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a single event with its properties."""
    events = list_events(db=db)
    event = next((e for e in events if e["id"] == event_id), None)

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return event


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_update: EventUpdate, db: Session = Depends(get_db)):
    """Update an event."""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Store old values
    old_value = {
        "name": db_event.name,
        "description": db_event.description,
        "category": db_event.category
    }

    # Update fields
    if event_update.name is not None:
        db_event.name = event_update.name
    if event_update.description is not None:
        db_event.description = event_update.description
    if event_update.category is not None:
        db_event.category = event_update.category

    db.commit()
    db.refresh(db_event)

    # Log update
    new_value = {
        "name": db_event.name,
        "description": db_event.description,
        "category": db_event.category
    }
    log_change(db, "event", event_id, "update", old_value=old_value, new_value=new_value)

    return get_event(event_id, db)


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Delete an event and clean up orphaned properties."""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    old_value = {
        "name": db_event.name,
        "description": db_event.description,
        "category": db_event.category
    }

    # Get property IDs associated with this event before deletion
    property_ids = [ep.property_id for ep in db_event.event_properties]

    # Delete the event (cascade will delete event_properties)
    db.delete(db_event)
    db.commit()

    # Clean up orphaned properties (properties not linked to any event)
    orphaned_count = 0
    for prop_id in property_ids:
        # Check if this property is still linked to any event
        is_linked = db.query(EventProperty).filter(EventProperty.property_id == prop_id).first()
        if not is_linked:
            # Property is orphaned, delete it
            orphaned_prop = db.query(Property).filter(Property.id == prop_id).first()
            if orphaned_prop:
                log_change(
                    db, "property", prop_id, "delete",
                    old_value={"name": orphaned_prop.name, "data_type": orphaned_prop.data_type},
                    changed_by="system (cleanup)"
                )
                db.delete(orphaned_prop)
                orphaned_count += 1

    db.commit()

    log_change(db, "event", event_id, "delete", old_value=old_value)

    return {
        "message": "Event deleted successfully",
        "orphaned_properties_cleaned": orphaned_count
    }


# ========== EVENT PROPERTY ENDPOINTS ==========

@app.post("/api/events/{event_id}/properties")
def add_property_to_event(
    event_id: int,
    prop: EventPropertyCreate,
    db: Session = Depends(get_db)
):
    """Add a property to an event."""
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Check if property exists
    property_obj = db.query(Property).filter(Property.name == prop.property_name).first()

    if property_obj:
        # Verify data type matches
        if property_obj.data_type != prop.data_type:
            raise HTTPException(
                status_code=400,
                detail=f"Property '{prop.property_name}' already exists with data type '{property_obj.data_type}'. Cannot redefine as '{prop.data_type}'."
            )
    else:
        # Create new property
        property_obj = Property(
            name=prop.property_name,
            data_type=prop.data_type,
            description=prop.description
        )
        db.add(property_obj)
        db.flush()

        log_change(
            db, "property", property_obj.id, "create",
            new_value={"name": property_obj.name, "data_type": property_obj.data_type}
        )

    # Check if association already exists
    existing = db.query(EventProperty).filter(
        EventProperty.event_id == event_id,
        EventProperty.property_id == property_obj.id,
        EventProperty.property_type == prop.property_type
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Property already added to this event")

    # Create association
    event_property = EventProperty(
        event_id=event_id,
        property_id=property_obj.id,
        property_type=prop.property_type,
        is_required=prop.is_required,
        example_value=prop.example_value
    )
    db.add(event_property)
    db.commit()

    log_change(
        db, "event_property", event_property.id, "create",
        new_value={
            "event_id": event_id,
            "property_id": property_obj.id,
            "property_type": prop.property_type
        }
    )

    return {"message": "Property added successfully", "property_id": property_obj.id}


@app.delete("/api/events/{event_id}/properties/{event_property_id}")
def remove_property_from_event(
    event_id: int,
    event_property_id: int,
    db: Session = Depends(get_db)
):
    """Remove a property from an event."""
    event_property = db.query(EventProperty).filter(
        EventProperty.id == event_property_id,
        EventProperty.event_id == event_id
    ).first()

    if not event_property:
        raise HTTPException(status_code=404, detail="Event property association not found")

    old_value = {
        "event_id": event_property.event_id,
        "property_id": event_property.property_id,
        "property_type": event_property.property_type
    }

    db.delete(event_property)
    db.commit()

    log_change(db, "event_property", event_property_id, "delete", old_value=old_value)

    return {"message": "Property removed successfully"}


# ========== PROPERTY REGISTRY ENDPOINTS ==========

@app.get("/api/properties", response_model=List[PropertyResponse])
def list_properties(db: Session = Depends(get_db)):
    """List all properties in the registry."""
    return db.query(Property).all()


@app.post("/api/properties", response_model=PropertyResponse)
def create_property(prop: PropertyCreate, db: Session = Depends(get_db)):
    """Create a new property in the registry."""
    # Check if property already exists
    existing = db.query(Property).filter(Property.name == prop.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Property '{prop.name}' already exists with data type '{existing.data_type}'"
        )

    db_property = Property(**prop.model_dump())
    db.add(db_property)
    db.commit()
    db.refresh(db_property)

    log_change(
        db, "property", db_property.id, "create",
        new_value={"name": db_property.name, "data_type": db_property.data_type},
        changed_by=prop.created_by
    )

    return db_property


@app.get("/api/properties/suggest")
def suggest_properties(q: str, db: Session = Depends(get_db)):
    """Get fuzzy-matched property suggestions."""
    all_properties = db.query(Property.name, Property.data_type).all()
    existing = [(p.name, p.data_type) for p in all_properties]

    suggestions = find_similar_properties(q, existing, threshold=0.6)

    return {"query": q, "suggestions": suggestions}


# ========== CHANGELOG ENDPOINTS ==========

@app.get("/api/changelog", response_model=List[ChangelogResponse])
def get_changelog(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get changelog with optional filters."""
    query = db.query(Changelog).order_by(Changelog.changed_at.desc())

    if entity_type:
        query = query.filter(Changelog.entity_type == entity_type)

    if entity_id:
        query = query.filter(Changelog.entity_id == entity_id)

    return query.limit(limit).all()


# ========== SEARCH ENDPOINT ==========

@app.get("/api/search")
def search(q: str, db: Session = Depends(get_db)):
    """Global search across events and properties."""
    events = db.query(Event).filter(
        (Event.name.ilike(f"%{q}%")) | (Event.description.ilike(f"%{q}%"))
    ).all()

    properties = db.query(Property).filter(
        (Property.name.ilike(f"%{q}%")) | (Property.description.ilike(f"%{q}%"))
    ).all()

    return {
        "query": q,
        "events": [{"id": e.id, "name": e.name, "type": "event"} for e in events],
        "properties": [{"id": p.id, "name": p.name, "type": "property"} for p in properties]
    }


@app.get("/api/features")
def get_features(db: Session = Depends(get_db)):
    """Get all unique features with 3 most recently used at the top, rest alphabetically sorted."""
    # Get all unique features (categories) from events ordered by most recent update
    recent_events = db.query(Event.category, Event.updated_at).filter(
        Event.category.isnot(None)
    ).order_by(Event.updated_at.desc()).all()

    # Track seen features and their most recent update
    seen = {}
    for category, updated_at in recent_events:
        if category and category not in seen:
            seen[category] = updated_at

    # Sort by most recent update and get top 3
    sorted_by_recent = sorted(seen.items(), key=lambda x: x[1], reverse=True)
    recent_features = [f[0] for f in sorted_by_recent[:3]]

    # Get remaining features sorted alphabetically
    remaining_features = sorted([f for f in seen.keys() if f not in recent_features])

    return {
        "recent": recent_features,
        "all": recent_features + remaining_features,
        "default": "Engagement"
    }


@app.get("/")
def root():
    return {"message": "Event Taxonomy Tool API", "version": "1.0.0"}


# ========== BULK IMPORT/EXPORT ENDPOINTS ==========

@app.get("/api/export/template/json")
def download_json_template():
    """Download a JSON template for bulk import."""
    template = [
        {
            "name": "Example Event",
            "description": "Description of what triggers this event",
            "category": "Engagement",
            "properties": [
                {
                    "property_name": "example_property",
                    "property_type": "event",
                    "data_type": "String",
                    "is_required": True,
                    "example_value": "example_value",
                    "description": "What this property represents"
                }
            ]
        }
    ]

    json_str = json.dumps(template, indent=2)
    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=event_template.json"}
    )


@app.get("/api/export/template/csv")
def download_csv_template():
    """Download a CSV template for bulk import."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "event_name", "event_description", "event_category",
        "property_name", "property_type", "data_type",
        "is_required", "example_value", "property_description"
    ])

    # Example rows
    writer.writerow([
        "Example Event", "Description of event", "Engagement",
        "user_id", "user", "String", "true", "user_123", "Unique user identifier"
    ])
    writer.writerow([
        "Example Event", "", "",
        "action_name", "event", "String", "true", "click", "Name of the action"
    ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=event_template.csv"}
    )


@app.post("/api/import/json")
async def import_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import events from JSON file."""
    try:
        content = await file.read()
        events_data = json.loads(content)

        if not isinstance(events_data, list):
            raise HTTPException(status_code=400, detail="JSON must be an array of events")

        imported_count = 0
        errors = []

        for idx, event_data in enumerate(events_data):
            try:
                event_create = EventCreate(**event_data)
                # Use the existing create_event logic
                db_event = Event(
                    name=event_create.name,
                    description=event_create.description,
                    category=event_create.category,
                    created_by=event_create.created_by or "bulk_import"
                )
                db.add(db_event)
                db.flush()

                for prop_create in event_create.properties:
                    property_obj = db.query(Property).filter(
                        Property.name == prop_create.property_name
                    ).first()

                    if property_obj:
                        if property_obj.data_type != prop_create.data_type:
                            errors.append(f"Event '{event_create.name}': Property '{prop_create.property_name}' type conflict")
                            continue
                    else:
                        property_obj = Property(
                            name=prop_create.property_name,
                            data_type=prop_create.data_type,
                            description=prop_create.description,
                            created_by="bulk_import"
                        )
                        db.add(property_obj)
                        db.flush()

                    event_property = EventProperty(
                        event_id=db_event.id,
                        property_id=property_obj.id,
                        property_type=prop_create.property_type,
                        is_required=prop_create.is_required,
                        example_value=prop_create.example_value
                    )
                    db.add(event_property)

                db.commit()
                imported_count += 1

            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")
                db.rollback()

        return {
            "imported": imported_count,
            "total": len(events_data),
            "errors": errors
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import events from CSV file."""
    try:
        content = await file.read()
        csv_data = io.StringIO(content.decode('utf-8'))
        reader = csv.DictReader(csv_data)

        events_dict = {}
        errors = []

        for idx, row in enumerate(reader):
            try:
                event_name = row.get('event_name', '').strip()
                if not event_name:
                    continue

                # Group properties by event
                if event_name not in events_dict:
                    events_dict[event_name] = {
                        'name': event_name,
                        'description': row.get('event_description', '').strip(),
                        'category': row.get('event_category', '').strip(),
                        'properties': []
                    }

                # Add property if present
                prop_name = row.get('property_name', '').strip()
                if prop_name:
                    events_dict[event_name]['properties'].append({
                        'property_name': prop_name,
                        'property_type': row.get('property_type', 'event').strip(),
                        'data_type': row.get('data_type', 'String').strip(),
                        'is_required': row.get('is_required', '').lower() in ['true', '1', 'yes'],
                        'example_value': row.get('example_value', '').strip(),
                        'description': row.get('property_description', '').strip()
                    })

            except Exception as e:
                errors.append(f"Row {idx + 2}: {str(e)}")

        imported_count = 0

        for event_data in events_dict.values():
            try:
                event_create = EventCreate(
                    name=event_data['name'],
                    description=event_data['description'],
                    category=event_data['category'],
                    created_by="bulk_import",
                    properties=[EventPropertyCreate(**p) for p in event_data['properties']]
                )

                db_event = Event(
                    name=event_create.name,
                    description=event_create.description,
                    category=event_create.category,
                    created_by="bulk_import"
                )
                db.add(db_event)
                db.flush()

                for prop_create in event_create.properties:
                    property_obj = db.query(Property).filter(
                        Property.name == prop_create.property_name
                    ).first()

                    if not property_obj:
                        property_obj = Property(
                            name=prop_create.property_name,
                            data_type=prop_create.data_type,
                            description=prop_create.description,
                            created_by="bulk_import"
                        )
                        db.add(property_obj)
                        db.flush()

                    event_property = EventProperty(
                        event_id=db_event.id,
                        property_id=property_obj.id,
                        property_type=prop_create.property_type,
                        is_required=prop_create.is_required,
                        example_value=prop_create.example_value
                    )
                    db.add(event_property)

                db.commit()
                imported_count += 1

            except Exception as e:
                errors.append(f"Event '{event_data['name']}': {str(e)}")
                db.rollback()

        return {
            "imported": imported_count,
            "total": len(events_dict),
            "errors": errors
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
