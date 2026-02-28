import csv
import io
import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from database import Event, EventVersion, Property, get_db, init_db
from models import (
    ChangelogResponse,
    EventArchiveRequest,
    EventCreate,
    EventResponse,
    EventRevertRequest,
    EventUpsertRequest,
    EventVersionDetailResponse,
    EventVersionSummaryResponse,
    PropertyCreate,
    PropertyResponse,
)
from utils import find_similar_properties
from versioning import (
    DuplicatePropertyError,
    InvalidEventStateError,
    RegistryConflictError,
    VersionConflictError,
    build_version_number_lookup,
    create_event_versioned,
    get_version_by_number,
    revert_event_versioned,
    serialize_changelog_entry,
    serialize_event,
    serialize_version_detail,
    serialize_version_summary,
    update_event_versioned,
    archive_event_versioned,
    restore_event_versioned,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not getattr(app.state, "skip_init_db", False):
        init_db()
    yield


app = FastAPI(title="Event Taxonomy Tracker", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)


def _raise_domain_error(error: Exception) -> None:
    if isinstance(error, (DuplicatePropertyError, RegistryConflictError)):
        raise HTTPException(status_code=400, detail=str(error))
    if isinstance(error, VersionConflictError):
        raise HTTPException(status_code=409, detail=str(error))
    if isinstance(error, InvalidEventStateError):
        raise HTTPException(status_code=409, detail=str(error))
    raise error


def _load_event(
    db: Session,
    event_id: int,
    *,
    include_versions: bool = False,
) -> Event:
    query = db.query(Event).options(selectinload(Event.event_properties))
    if include_versions:
        query = query.options(selectinload(Event.versions))

    event = query.filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


def _parse_iso_datetime(value: str, field_name: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name} format: {value}. Use ISO format.",
        ) from exc


def _score_event(event: dict, search_term: str) -> int:
    score = 0
    if search_term in event["name"].lower():
        score += 100
        if event["name"].lower() == search_term:
            score += 50

    if event["category"] and search_term in event["category"].lower():
        score += 75
        if event["category"].lower() == search_term:
            score += 25

    if event["description"] and search_term in event["description"].lower():
        score += 50

    for prop in event["properties"]:
        if search_term in prop["property_name"].lower():
            score += 30
            if prop["property_name"].lower() == search_term:
                score += 10
        if prop["description"] and search_term in prop["description"].lower():
            score += 20
        if search_term in prop["data_type"].lower():
            score += 10

    if event["created_by"] and search_term in event["created_by"].lower():
        score += 15

    return score


@app.get("/api/events", response_model=List[EventResponse])
def list_events(
    response: Response,
    q: Optional[str] = None,
    category: Optional[str] = None,
    created_by: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    include_archived: bool = False,
    only_archived: bool = False,
    sort_order: Literal["asc", "desc"] = Query(
        default="asc",
        description="Sort by created_at (asc or desc)",
    ),
    skip: int = Query(default=0, ge=0, description="Number of events to skip"),
    limit: int = Query(default=100, ge=1, le=500, description="Maximum number of events to return"),
    db: Session = Depends(get_db),
):
    base_query = db.query(Event).options(selectinload(Event.event_properties))

    if only_archived:
        base_query = base_query.filter(Event.is_archived.is_(True))
    elif not include_archived:
        base_query = base_query.filter(Event.is_archived.is_(False))

    if category:
        base_query = base_query.filter(Event.category == category)

    if created_by:
        base_query = base_query.filter(Event.created_by.ilike(f"%{created_by}%"))

    if date_from:
        base_query = base_query.filter(Event.created_at >= _parse_iso_datetime(date_from, "date_from"))

    if date_to:
        base_query = base_query.filter(Event.created_at <= _parse_iso_datetime(date_to, "date_to"))

    total_count = base_query.count()
    base_query = (
        base_query.order_by(Event.created_at.desc())
        if sort_order == "desc"
        else base_query.order_by(Event.created_at.asc())
    )

    events = base_query.all() if q else base_query.offset(skip).limit(limit).all()
    serialized = [serialize_event(event) for event in events]

    if q:
        search_term = q.lower()
        scored = []
        for event in serialized:
            score = _score_event(event, search_term)
            if score > 0:
                scored.append((score, event))

        scored.sort(key=lambda item: item[1]["created_at"], reverse=(sort_order == "desc"))
        scored.sort(key=lambda item: item[0], reverse=True)
        ranked = [event for _, event in scored]
        total_count = len(ranked)
        serialized = ranked[skip: skip + limit]

    response.headers["X-Total-Count"] = str(total_count)
    return serialized


@app.post("/api/events", response_model=EventResponse)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    try:
        created_event = create_event_versioned(db, event)
        db.commit()
        return serialize_event(_load_event(db, created_event.id))
    except (DuplicatePropertyError, RegistryConflictError, InvalidEventStateError) as error:
        db.rollback()
        _raise_domain_error(error)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Event creation failed due to a conflicting database constraint",
        ) from error


@app.get("/api/events/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    return serialize_event(_load_event(db, event_id))


@app.put("/api/events/{event_id}", response_model=EventResponse)
def update_event(event_id: int, payload: EventUpsertRequest, db: Session = Depends(get_db)):
    event = _load_event(db, event_id)

    try:
        update_event_versioned(db, event, payload)
        db.commit()
        return serialize_event(_load_event(db, event_id))
    except (DuplicatePropertyError, RegistryConflictError, VersionConflictError, InvalidEventStateError) as error:
        db.rollback()
        _raise_domain_error(error)
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Event update failed due to a conflicting database constraint",
        ) from error


@app.post("/api/events/{event_id}/archive", response_model=EventResponse)
def archive_event(event_id: int, payload: EventArchiveRequest, db: Session = Depends(get_db)):
    event = _load_event(db, event_id)

    try:
        archive_event_versioned(
            db,
            event,
            base_version_number=payload.base_version_number,
            changed_by=payload.changed_by,
            change_reason=payload.change_reason,
        )
        db.commit()
        return serialize_event(_load_event(db, event_id))
    except (VersionConflictError, InvalidEventStateError, RegistryConflictError) as error:
        db.rollback()
        _raise_domain_error(error)


@app.post("/api/events/{event_id}/restore", response_model=EventResponse)
def restore_event(event_id: int, payload: EventArchiveRequest, db: Session = Depends(get_db)):
    event = _load_event(db, event_id)

    try:
        restore_event_versioned(
            db,
            event,
            base_version_number=payload.base_version_number,
            changed_by=payload.changed_by,
            change_reason=payload.change_reason,
        )
        db.commit()
        return serialize_event(_load_event(db, event_id))
    except (VersionConflictError, InvalidEventStateError, RegistryConflictError) as error:
        db.rollback()
        _raise_domain_error(error)


@app.get("/api/events/{event_id}/versions", response_model=List[EventVersionSummaryResponse])
def list_event_versions(event_id: int, db: Session = Depends(get_db)):
    event = _load_event(db, event_id, include_versions=True)
    lookup = build_version_number_lookup(event.versions)

    versions = sorted(event.versions, key=lambda version: version.version_number, reverse=True)
    return [serialize_version_summary(event, version, lookup) for version in versions]


@app.get("/api/events/{event_id}/versions/{version_number}", response_model=EventVersionDetailResponse)
def get_event_version(event_id: int, version_number: int, db: Session = Depends(get_db)):
    event = _load_event(db, event_id, include_versions=True)
    target_version = next(
        (version for version in event.versions if version.version_number == version_number),
        None,
    )
    if not target_version:
        raise HTTPException(status_code=404, detail="Event version not found")

    lookup = build_version_number_lookup(event.versions)
    return serialize_version_detail(event, target_version, lookup)


@app.post("/api/events/{event_id}/versions/{version_number}/revert", response_model=EventResponse)
def revert_event_version(
    event_id: int,
    version_number: int,
    payload: EventRevertRequest,
    db: Session = Depends(get_db),
):
    event = _load_event(db, event_id)
    target_version = get_version_by_number(db, event_id, version_number)
    if not target_version:
        raise HTTPException(status_code=404, detail="Event version not found")

    try:
        revert_event_versioned(
            db,
            event,
            target_version=target_version,
            base_version_number=payload.base_version_number,
            changed_by=payload.changed_by,
            change_reason=payload.change_reason,
        )
        db.commit()
        return serialize_event(_load_event(db, event_id))
    except (VersionConflictError, InvalidEventStateError, RegistryConflictError) as error:
        db.rollback()
        _raise_domain_error(error)


@app.get("/api/properties", response_model=List[PropertyResponse])
def list_properties(db: Session = Depends(get_db)):
    return db.query(Property).order_by(Property.name.asc()).all()


@app.post("/api/properties", response_model=PropertyResponse)
def create_property(prop: PropertyCreate, db: Session = Depends(get_db)):
    existing = db.query(Property).filter(Property.name == prop.name).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Property '{prop.name}' already exists with data type '{existing.data_type}'",
        )

    db_property = Property(**prop.model_dump())
    db.add(db_property)
    db.commit()
    db.refresh(db_property)
    return db_property


@app.get("/api/properties/suggest")
def suggest_properties(q: str, db: Session = Depends(get_db)):
    all_properties = db.query(Property.name, Property.data_type).all()
    existing = [(prop.name, prop.data_type) for prop in all_properties]
    suggestions = find_similar_properties(q, existing, threshold=0.6)
    return {"query": q, "suggestions": suggestions}


@app.get("/api/changelog", response_model=List[ChangelogResponse])
def get_changelog(
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    limit: int = Query(default=50, ge=1, le=500, description="Maximum number of entries to return"),
    db: Session = Depends(get_db),
):
    if entity_type and entity_type != "event":
        return []

    query = (
        db.query(EventVersion, Event)
        .join(Event, Event.id == EventVersion.event_id)
        .order_by(EventVersion.created_at.desc())
    )

    if entity_id:
        query = query.filter(EventVersion.event_id == entity_id)

    rows = query.limit(limit).all()
    return [serialize_changelog_entry(event, version) for version, event in rows]


@app.get("/api/search")
def search(q: str, db: Session = Depends(get_db)):
    escaped_query = '"' + q.replace('"', '""') + '"'

    try:
        fts_query = db.execute(
            text(
                """
                SELECT DISTINCT e.id, e.name
                FROM events e
                INNER JOIN events_fts fts ON e.id = fts.rowid
                WHERE events_fts MATCH :query
                  AND e.is_archived = 0
                ORDER BY rank
                LIMIT 50
                """
            ),
            {"query": escaped_query},
        ).fetchall()
        events = [{"id": row[0], "name": row[1], "type": "event"} for row in fts_query]
    except Exception:
        events = []

    properties = db.query(Property).filter(
        (Property.name.ilike(f"%{q}%")) | (Property.description.ilike(f"%{q}%"))
    ).all()

    return {
        "query": q,
        "events": events,
        "properties": [{"id": prop.id, "name": prop.name, "type": "property"} for prop in properties],
    }


@app.get("/api/features")
def get_features(db: Session = Depends(get_db)):
    recent_events = (
        db.query(Event.category, Event.updated_at)
        .filter(Event.category.isnot(None), Event.is_archived.is_(False))
        .order_by(Event.updated_at.desc())
        .all()
    )

    seen: dict[str, datetime] = {}
    for category, updated_at in recent_events:
        if category and category not in seen:
            seen[category] = updated_at

    sorted_by_recent = sorted(seen.items(), key=lambda item: item[1], reverse=True)
    recent_features = [item[0] for item in sorted_by_recent[:3]]
    remaining_features = sorted([feature for feature in seen.keys() if feature not in recent_features])

    return {
        "recent": recent_features,
        "all": recent_features + remaining_features,
        "default": "Engagement",
    }


@app.get("/api/filter-options")
def get_filter_options(db: Session = Depends(get_db)):
    active_events = db.query(Event).filter(Event.is_archived.is_(False))

    categories = active_events.with_entities(Event.category).filter(Event.category.isnot(None)).distinct().all()
    creators = active_events.with_entities(Event.created_by).filter(Event.created_by.isnot(None)).distinct().all()
    date_range = active_events.with_entities(
        func.min(Event.created_at).label("min_date"),
        func.max(Event.created_at).label("max_date"),
    ).first()

    return {
        "categories": sorted([category[0] for category in categories if category[0]]),
        "creators": sorted([creator[0] for creator in creators if creator[0]]),
        "date_range": {
            "min": date_range.min_date.isoformat() if date_range.min_date else None,
            "max": date_range.max_date.isoformat() if date_range.max_date else None,
        },
    }


@app.get("/")
def root():
    return {"message": "Event Taxonomy Tracker API", "version": "2.0.0"}


@app.get("/api/export/template/json")
def download_json_template():
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
                    "description": "What this property represents",
                }
            ],
        }
    ]

    json_str = json.dumps(template, indent=2)
    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=event_template.json"},
    )


@app.get("/api/export/template/csv")
def download_csv_template():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "event_name",
            "event_description",
            "event_category",
            "property_name",
            "property_type",
            "data_type",
            "is_required",
            "example_value",
            "property_description",
        ]
    )
    writer.writerow(
        [
            "Example Event",
            "Description of event",
            "Engagement",
            "user_id",
            "user",
            "String",
            "true",
            "user_123",
            "Unique user identifier",
        ]
    )
    writer.writerow(
        [
            "Example Event",
            "",
            "",
            "action_name",
            "event",
            "String",
            "true",
            "click",
            "Name of the action",
        ]
    )

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=event_template.csv"},
    )


@app.post("/api/import/json")
async def import_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
                create_event_versioned(db, event_create)
                db.commit()
                imported_count += 1
            except (DuplicatePropertyError, RegistryConflictError, InvalidEventStateError) as error:
                db.rollback()
                errors.append(f"Row {idx + 1}: {str(error)}")
            except ValidationError as error:
                db.rollback()
                errors.append(f"Row {idx + 1}: {error.errors()}")
            except IntegrityError:
                db.rollback()
                errors.append(f"Row {idx + 1}: Integrity constraint conflict")
            except Exception as error:
                db.rollback()
                errors.append(f"Row {idx + 1}: {str(error)}")

        return {
            "imported": imported_count,
            "total": len(events_data),
            "errors": errors,
        }
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=400, detail="Invalid JSON file") from error
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/import/csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        csv_data = io.StringIO(content.decode("utf-8"))
        reader = csv.DictReader(csv_data)

        events_dict: dict[str, dict] = {}
        errors = []

        for idx, row in enumerate(reader):
            try:
                event_name = row.get("event_name", "").strip()
                if not event_name:
                    continue

                if event_name not in events_dict:
                    events_dict[event_name] = {
                        "name": event_name,
                        "description": row.get("event_description", "").strip() or None,
                        "category": row.get("event_category", "").strip() or None,
                        "created_by": "bulk_import",
                        "properties": [],
                    }

                property_name = row.get("property_name", "").strip()
                if property_name:
                    events_dict[event_name]["properties"].append(
                        {
                            "property_name": property_name,
                            "property_type": row.get("property_type", "event").strip(),
                            "data_type": row.get("data_type", "String").strip(),
                            "is_required": row.get("is_required", "").lower() in {"true", "1", "yes"},
                            "example_value": row.get("example_value", "").strip() or None,
                            "description": row.get("property_description", "").strip() or None,
                        }
                    )
            except Exception as error:
                errors.append(f"Row {idx + 2}: {str(error)}")

        imported_count = 0
        for event_data in events_dict.values():
            try:
                event_create = EventCreate(**event_data)
                create_event_versioned(db, event_create)
                db.commit()
                imported_count += 1
            except (DuplicatePropertyError, RegistryConflictError, InvalidEventStateError) as error:
                db.rollback()
                errors.append(f"Event '{event_data['name']}': {str(error)}")
            except ValidationError as error:
                db.rollback()
                errors.append(f"Event '{event_data['name']}': {error.errors()}")
            except IntegrityError:
                db.rollback()
                errors.append(f"Event '{event_data['name']}': Integrity constraint conflict")
            except Exception as error:
                db.rollback()
                errors.append(f"Event '{event_data['name']}': {str(error)}")

        return {
            "imported": imported_count,
            "total": len(events_dict),
            "errors": errors,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
