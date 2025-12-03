from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

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
    """Delete an event."""
    db_event = db.query(Event).filter(Event.id == event_id).first()

    if not db_event:
        raise HTTPException(status_code=404, detail="Event not found")

    old_value = {
        "name": db_event.name,
        "description": db_event.description,
        "category": db_event.category
    }

    db.delete(db_event)
    db.commit()

    log_change(db, "event", event_id, "delete", old_value=old_value)

    return {"message": "Event deleted successfully"}


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


@app.get("/")
def root():
    return {"message": "Event Taxonomy Tool API", "version": "1.0.0"}
