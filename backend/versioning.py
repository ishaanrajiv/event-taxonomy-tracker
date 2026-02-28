import hashlib
import json
from datetime import UTC, datetime
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from database import Event, EventProperty, EventVersion, Property
from models import EventCreate, EventUpsertRequest, EventWriteProperty


class VersioningError(Exception):
    """Base error for event versioning operations."""


class DuplicatePropertyError(VersioningError):
    """Raised when the same property appears multiple times in one event payload."""


class RegistryConflictError(VersioningError):
    """Raised when a property conflicts with the global registry."""


class VersionConflictError(VersioningError):
    """Raised when a write is based on a stale event version."""

    def __init__(self, current_version_number: int):
        self.current_version_number = current_version_number
        super().__init__(
            f"Event has changed since this view was loaded. Current version is {current_version_number}."
        )


class InvalidEventStateError(VersioningError):
    """Raised when an operation is not valid for the event's current state."""


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_property(prop: EventWriteProperty | dict) -> dict:
    if isinstance(prop, EventWriteProperty):
        payload = prop.model_dump()
    else:
        payload = dict(prop)

    return {
        "property_name": payload["property_name"].strip(),
        "property_type": payload["property_type"],
        "data_type": payload["data_type"],
        "description": _normalize_optional_text(payload.get("description")),
        "is_required": bool(payload.get("is_required", False)),
        "example_value": _normalize_optional_text(payload.get("example_value")),
    }


def normalize_properties(properties: Iterable[EventWriteProperty | dict]) -> list[dict]:
    normalized = [_normalize_property(prop) for prop in properties]
    seen: set[tuple[str, str]] = set()
    duplicates: list[str] = []

    for prop in normalized:
        key = (prop["property_name"], prop["property_type"])
        if key in seen:
            duplicates.append(f"{prop['property_name']} ({prop['property_type']})")
        seen.add(key)

    if duplicates:
        raise DuplicatePropertyError(
            f"Duplicate properties in payload: {', '.join(sorted(set(duplicates)))}"
        )

    normalized.sort(key=lambda prop: (prop["property_type"], prop["property_name"]))
    return normalized


def build_snapshot(
    *,
    name: str,
    description: Optional[str],
    category: Optional[str],
    properties: Iterable[EventWriteProperty | dict],
    is_archived: bool,
) -> dict:
    normalized_properties = normalize_properties(properties)
    return {
        "event": {
            "name": name.strip(),
            "description": _normalize_optional_text(description),
            "category": _normalize_optional_text(category),
            "is_archived": is_archived,
        },
        "properties": normalized_properties,
    }


def checksum_snapshot(snapshot: dict) -> str:
    canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_diff(previous_snapshot: Optional[dict], next_snapshot: dict) -> dict:
    metadata_diff: dict[str, dict[str, Optional[str] | bool]] = {}

    previous_event = previous_snapshot["event"] if previous_snapshot else {}
    next_event = next_snapshot["event"]
    for key in ("name", "description", "category", "is_archived"):
        previous_value = previous_event.get(key)
        next_value = next_event.get(key)
        if previous_snapshot is None or previous_value != next_value:
            metadata_diff[key] = {"from": previous_value, "to": next_value}

    previous_properties = {
        f"{prop['property_name']}:{prop['property_type']}": prop
        for prop in (previous_snapshot["properties"] if previous_snapshot else [])
    }
    next_properties = {
        f"{prop['property_name']}:{prop['property_type']}": prop
        for prop in next_snapshot["properties"]
    }

    added = [next_properties[key] for key in sorted(next_properties.keys() - previous_properties.keys())]
    removed = [
        previous_properties[key]
        for key in sorted(previous_properties.keys() - next_properties.keys())
    ]
    updated = []
    for key in sorted(previous_properties.keys() & next_properties.keys()):
        before = previous_properties[key]
        after = next_properties[key]
        if before != after:
            updated.append({"key": key, "before": before, "after": after})

    return {
        "metadata": metadata_diff,
        "properties": {
            "added": added,
            "removed": removed,
            "updated": updated,
        },
    }


def build_summary(
    action: str,
    diff: dict,
    *,
    target_version_number: Optional[int] = None,
    property_count: int = 0,
) -> str:
    if action == "create":
        noun = "property" if property_count == 1 else "properties"
        return f"Created event with {property_count} {noun}"
    if action == "archive":
        return "Archived event"
    if action == "restore":
        return "Restored event"
    if action == "revert":
        return f"Reverted to version {target_version_number}"

    metadata_changes = len(diff["metadata"])
    added = len(diff["properties"]["added"])
    removed = len(diff["properties"]["removed"])
    updated = len(diff["properties"]["updated"])

    parts = []
    if metadata_changes:
        noun = "field" if metadata_changes == 1 else "fields"
        parts.append(f"{metadata_changes} metadata {noun}")
    if added:
        noun = "property" if added == 1 else "properties"
        parts.append(f"added {added} {noun}")
    if removed:
        noun = "property" if removed == 1 else "properties"
        parts.append(f"removed {removed} {noun}")
    if updated:
        noun = "property" if updated == 1 else "properties"
        parts.append(f"updated {updated} {noun}")

    if not parts:
        return "No changes"

    return "Updated " + ", ".join(parts)


def _upsert_registry_properties(
    db: Session,
    properties: list[dict],
    *,
    actor: Optional[str],
) -> dict[str, Property]:
    registry: dict[str, Property] = {}

    for prop in properties:
        registry_property = (
            db.query(Property).filter(Property.name == prop["property_name"]).first()
        )
        if registry_property:
            if registry_property.data_type != prop["data_type"]:
                raise RegistryConflictError(
                    f"Property '{prop['property_name']}' already exists with data type "
                    f"'{registry_property.data_type}'. Cannot redefine as '{prop['data_type']}'."
                )
            if not registry_property.description and prop["description"]:
                registry_property.description = prop["description"]
        else:
            registry_property = Property(
                name=prop["property_name"],
                data_type=prop["data_type"],
                description=prop["description"],
                created_by=actor,
            )
            db.add(registry_property)
            db.flush()

        registry[prop["property_name"]] = registry_property

    return registry


def _replace_event_projection(
    db: Session,
    event: Event,
    snapshot: dict,
    registry: dict[str, Property],
) -> None:
    event_data = snapshot["event"]
    event.name = event_data["name"]
    event.description = event_data["description"]
    event.category = event_data["category"]
    event.is_archived = event_data["is_archived"]
    event.archived_at = datetime.now(UTC) if event.is_archived else None
    event.archived_by = None

    for existing_property in list(event.event_properties):
        db.delete(existing_property)
    db.flush()

    for prop in snapshot["properties"]:
        registry_property = registry[prop["property_name"]]
        db.add(
            EventProperty(
                event_id=event.id,
                property_id=registry_property.id,
                property_name=prop["property_name"],
                property_type=prop["property_type"],
                data_type=prop["data_type"],
                description=prop["description"],
                is_required=prop["is_required"],
                example_value=prop["example_value"],
            )
        )


def _current_version(db: Session, event: Event) -> Optional[EventVersion]:
    if not event.current_version_id:
        return None
    return (
        db.query(EventVersion)
        .filter(
            EventVersion.id == event.current_version_id,
            EventVersion.event_id == event.id,
        )
        .first()
    )


def ensure_base_version(event: Event, base_version_number: int) -> None:
    if base_version_number != event.current_version_number:
        raise VersionConflictError(event.current_version_number)


def _write_version(
    db: Session,
    *,
    event: Event,
    action: str,
    snapshot: dict,
    diff: dict,
    actor: Optional[str],
    change_reason: Optional[str],
    target_version_number: Optional[int] = None,
    reverted_from_version_id: Optional[int] = None,
) -> EventVersion:
    parent_version = _current_version(db, event)
    event.lock_version += 1
    event.updated_at = datetime.now(UTC)
    event.is_archived = snapshot["event"]["is_archived"]
    if event.is_archived:
        event.archived_at = event.updated_at
        event.archived_by = actor
    else:
        event.archived_at = None
        event.archived_by = None

    version = EventVersion(
        event_id=event.id,
        version_number=event.current_version_number + 1,
        parent_version_id=parent_version.id if parent_version else None,
        action=action,
        summary=build_summary(
            action,
            diff,
            target_version_number=target_version_number,
            property_count=len(snapshot["properties"]),
        ),
        change_reason=_normalize_optional_text(change_reason),
        snapshot=snapshot,
        diff=diff,
        checksum=checksum_snapshot(snapshot),
        created_by=actor,
        reverted_from_version_id=reverted_from_version_id,
    )
    db.add(version)
    db.flush()

    event.current_version_number = version.version_number
    event.current_version_id = version.id
    return version


def create_event_versioned(db: Session, payload: EventCreate) -> Event:
    snapshot = build_snapshot(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        properties=payload.properties,
        is_archived=False,
    )
    registry = _upsert_registry_properties(
        db,
        snapshot["properties"],
        actor=payload.created_by,
    )

    event = Event(
        name=snapshot["event"]["name"],
        description=snapshot["event"]["description"],
        category=snapshot["event"]["category"],
        created_by=payload.created_by,
    )
    db.add(event)
    db.flush()

    _replace_event_projection(db, event, snapshot, registry)
    _write_version(
        db,
        event=event,
        action="create",
        snapshot=snapshot,
        diff=build_diff(None, snapshot),
        actor=payload.created_by,
        change_reason=payload.change_reason,
    )
    db.flush()
    return event


def update_event_versioned(db: Session, event: Event, payload: EventUpsertRequest) -> tuple[Event, bool]:
    if event.is_archived:
        raise InvalidEventStateError("Archived events must be restored before they can be edited.")

    ensure_base_version(event, payload.base_version_number)
    current_version = _current_version(db, event)
    if current_version is None:
        raise InvalidEventStateError("Event has no current version.")

    snapshot = build_snapshot(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        properties=payload.properties,
        is_archived=False,
    )
    checksum = checksum_snapshot(snapshot)
    if checksum == current_version.checksum:
        return event, False

    registry = _upsert_registry_properties(
        db,
        snapshot["properties"],
        actor=payload.changed_by,
    )
    _replace_event_projection(db, event, snapshot, registry)
    _write_version(
        db,
        event=event,
        action="update",
        snapshot=snapshot,
        diff=build_diff(current_version.snapshot, snapshot),
        actor=payload.changed_by,
        change_reason=payload.change_reason,
    )
    db.flush()
    return event, True


def archive_event_versioned(
    db: Session,
    event: Event,
    *,
    base_version_number: int,
    changed_by: Optional[str],
    change_reason: Optional[str],
) -> tuple[Event, bool]:
    if event.is_archived:
        raise InvalidEventStateError("Event is already archived.")

    ensure_base_version(event, base_version_number)
    current_version = _current_version(db, event)
    if current_version is None:
        raise InvalidEventStateError("Event has no current version.")

    snapshot = build_snapshot(
        name=current_version.snapshot["event"]["name"],
        description=current_version.snapshot["event"]["description"],
        category=current_version.snapshot["event"]["category"],
        properties=current_version.snapshot["properties"],
        is_archived=True,
    )
    registry = _upsert_registry_properties(
        db,
        snapshot["properties"],
        actor=changed_by,
    )
    _replace_event_projection(db, event, snapshot, registry)
    _write_version(
        db,
        event=event,
        action="archive",
        snapshot=snapshot,
        diff=build_diff(current_version.snapshot, snapshot),
        actor=changed_by,
        change_reason=change_reason,
    )
    db.flush()
    return event, True


def restore_event_versioned(
    db: Session,
    event: Event,
    *,
    base_version_number: int,
    changed_by: Optional[str],
    change_reason: Optional[str],
) -> tuple[Event, bool]:
    if not event.is_archived:
        raise InvalidEventStateError("Event is already active.")

    ensure_base_version(event, base_version_number)
    current_version = _current_version(db, event)
    if current_version is None:
        raise InvalidEventStateError("Event has no current version.")

    snapshot = build_snapshot(
        name=current_version.snapshot["event"]["name"],
        description=current_version.snapshot["event"]["description"],
        category=current_version.snapshot["event"]["category"],
        properties=current_version.snapshot["properties"],
        is_archived=False,
    )
    registry = _upsert_registry_properties(
        db,
        snapshot["properties"],
        actor=changed_by,
    )
    _replace_event_projection(db, event, snapshot, registry)
    _write_version(
        db,
        event=event,
        action="restore",
        snapshot=snapshot,
        diff=build_diff(current_version.snapshot, snapshot),
        actor=changed_by,
        change_reason=change_reason,
    )
    db.flush()
    return event, True


def revert_event_versioned(
    db: Session,
    event: Event,
    *,
    target_version: EventVersion,
    base_version_number: int,
    changed_by: Optional[str],
    change_reason: Optional[str],
) -> tuple[Event, bool]:
    ensure_base_version(event, base_version_number)
    current_version = _current_version(db, event)
    if current_version is None:
        raise InvalidEventStateError("Event has no current version.")

    if current_version.checksum == target_version.checksum:
        return event, False

    snapshot = target_version.snapshot
    registry = _upsert_registry_properties(
        db,
        snapshot["properties"],
        actor=changed_by,
    )
    _replace_event_projection(db, event, snapshot, registry)
    _write_version(
        db,
        event=event,
        action="revert",
        snapshot=snapshot,
        diff=build_diff(current_version.snapshot, snapshot),
        actor=changed_by,
        change_reason=change_reason,
        target_version_number=target_version.version_number,
        reverted_from_version_id=target_version.id,
    )
    db.flush()
    return event, True


def get_version_by_number(db: Session, event_id: int, version_number: int) -> Optional[EventVersion]:
    return (
        db.query(EventVersion)
        .filter(
            EventVersion.event_id == event_id,
            EventVersion.version_number == version_number,
        )
        .first()
    )


def serialize_event(event: Event) -> dict:
    properties = sorted(
        event.event_properties,
        key=lambda prop: (prop.property_type, prop.property_name),
    )
    return {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "category": event.category,
        "created_by": event.created_by,
        "created_at": event.created_at,
        "updated_at": event.updated_at,
        "version_number": event.current_version_number,
        "is_archived": event.is_archived,
        "archived_at": event.archived_at,
        "archived_by": event.archived_by,
        "lock_version": event.lock_version,
        "properties": [
            {
                "id": prop.id,
                "property_id": prop.property_id,
                "property_name": prop.property_name,
                "property_type": prop.property_type,
                "data_type": prop.data_type,
                "description": prop.description,
                "is_required": prop.is_required,
                "example_value": prop.example_value,
            }
            for prop in properties
        ],
    }


def build_version_number_lookup(versions: Iterable[EventVersion]) -> dict[int, int]:
    return {version.id: version.version_number for version in versions}


def serialize_version_summary(
    event: Event,
    version: EventVersion,
    version_number_lookup: dict[int, int],
) -> dict:
    return {
        "id": version.id,
        "event_id": event.id,
        "event_name": version.snapshot["event"]["name"],
        "version_number": version.version_number,
        "action": version.action,
        "summary": version.summary,
        "change_reason": version.change_reason,
        "created_by": version.created_by,
        "created_at": version.created_at,
        "parent_version_number": version_number_lookup.get(version.parent_version_id),
        "reverted_from_version_number": version_number_lookup.get(version.reverted_from_version_id),
        "is_current": event.current_version_id == version.id,
    }


def serialize_version_detail(
    event: Event,
    version: EventVersion,
    version_number_lookup: dict[int, int],
) -> dict:
    summary = serialize_version_summary(event, version, version_number_lookup)
    summary.update(
        {
            "checksum": version.checksum,
            "snapshot": version.snapshot,
            "diff": version.diff,
        }
    )
    return summary


def serialize_changelog_entry(event: Event, version: EventVersion) -> dict:
    return {
        "id": version.id,
        "entity_type": "event",
        "entity_id": event.id,
        "event_name": version.snapshot["event"]["name"],
        "version_number": version.version_number,
        "action": version.action,
        "summary": version.summary,
        "change_reason": version.change_reason,
        "diff": version.diff,
        "snapshot": version.snapshot,
        "changed_by": version.created_by,
        "changed_at": version.created_at,
        "is_current": event.current_version_id == version.id,
    }
