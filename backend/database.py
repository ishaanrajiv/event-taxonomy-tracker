from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    event,
    inspect,
    text,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# Get the backend directory (where this file is located)
BACKEND_DIR = Path(__file__).parent
DB_PATH = BACKEND_DIR / "event_taxonomy.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)


@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.execute("PRAGMA temp_store=MEMORY")
    cursor.execute("PRAGMA mmap_size=268435456")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    data_type = Column(String, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    created_by = Column(String)

    event_properties = relationship("EventProperty", back_populates="property")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(String, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    created_by = Column(String)
    current_version_number = Column(Integer, nullable=False, default=0)
    current_version_id = Column(Integer, index=True)
    is_archived = Column(Boolean, nullable=False, default=False, index=True)
    archived_at = Column(DateTime)
    archived_by = Column(String)
    lock_version = Column(Integer, nullable=False, default=0)

    event_properties = relationship(
        "EventProperty",
        back_populates="event",
        cascade="all, delete-orphan",
    )
    versions = relationship(
        "EventVersion",
        back_populates="event",
        cascade="all, delete-orphan",
        order_by="EventVersion.version_number",
    )


class EventProperty(Base):
    __tablename__ = "event_properties"
    __table_args__ = (
        UniqueConstraint(
            "event_id",
            "property_name",
            "property_type",
            name="uq_event_live_property_key",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False, index=True)
    property_name = Column(String, nullable=False, index=True)
    property_type = Column(String, nullable=False)
    data_type = Column(String, nullable=False)
    description = Column(Text)
    is_required = Column(Boolean, default=False, nullable=False)
    example_value = Column(Text)

    event = relationship("Event", back_populates="event_properties")
    property = relationship("Property", back_populates="event_properties")


class EventVersion(Base):
    __tablename__ = "event_versions"
    __table_args__ = (
        UniqueConstraint("event_id", "version_number", name="uq_event_version_number"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(
        Integer,
        ForeignKey("events.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    parent_version_id = Column(Integer, ForeignKey("event_versions.id"), index=True)
    action = Column(String, nullable=False)
    summary = Column(String, nullable=False)
    change_reason = Column(Text)
    snapshot = Column(JSON, nullable=False)
    diff = Column(JSON, nullable=False)
    checksum = Column(String(64), nullable=False, index=True)
    created_by = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(UTC), nullable=False)
    reverted_from_version_id = Column(Integer, ForeignKey("event_versions.id"), index=True)

    event = relationship("Event", back_populates="versions")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _reset_legacy_sqlite_schema() -> None:
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if not table_names:
        return

    required_event_columns = {
        "current_version_number",
        "current_version_id",
        "is_archived",
        "archived_at",
        "archived_by",
        "lock_version",
    }
    required_event_property_columns = {
        "property_name",
        "property_type",
        "data_type",
        "description",
    }

    events_columns = (
        {column["name"] for column in inspector.get_columns("events")}
        if "events" in table_names
        else set()
    )
    event_property_columns = (
        {column["name"] for column in inspector.get_columns("event_properties")}
        if "event_properties" in table_names
        else set()
    )

    needs_reset = (
        "event_versions" not in table_names
        or not required_event_columns.issubset(events_columns)
        or not required_event_property_columns.issubset(event_property_columns)
    )

    if not needs_reset:
        return

    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys=OFF"))
        objects = conn.execute(
            text(
                """
                SELECT type, name
                FROM sqlite_master
                WHERE name NOT LIKE 'sqlite_%'
                ORDER BY CASE type
                    WHEN 'trigger' THEN 0
                    WHEN 'view' THEN 1
                    ELSE 2
                END
                """
            )
        ).fetchall()

        for object_type, name in objects:
            quoted_name = _quote_identifier(name)
            if object_type == "trigger":
                conn.execute(text(f"DROP TRIGGER IF EXISTS {quoted_name}"))
            elif object_type in {"table", "view"}:
                conn.execute(text(f"DROP TABLE IF EXISTS {quoted_name}"))

        conn.execute(text("PRAGMA foreign_keys=ON"))


def _ensure_fts() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
                    name,
                    description,
                    category,
                    content='events',
                    content_rowid='id'
                )
                """
            )
        )

        conn.execute(
            text(
                """
                INSERT INTO events_fts(rowid, name, description, category)
                SELECT id, name, COALESCE(description, ''), COALESCE(category, '')
                FROM events
                WHERE id NOT IN (SELECT rowid FROM events_fts)
                """
            )
        )

        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
                    INSERT INTO events_fts(rowid, name, description, category)
                    VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
                    INSERT INTO events_fts(events_fts, rowid, name, description, category)
                    VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
                    INSERT INTO events_fts(rowid, name, description, category)
                    VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
                END
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
                    INSERT INTO events_fts(events_fts, rowid, name, description, category)
                    VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
                END
                """
            )
        )


def init_db():
    _reset_legacy_sqlite_schema()
    Base.metadata.create_all(bind=engine)
    _ensure_fts()
