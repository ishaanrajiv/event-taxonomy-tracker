from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.engine import Engine
from datetime import datetime
from pathlib import Path

# Get the backend directory (where this file is located)
BACKEND_DIR = Path(__file__).parent
DB_PATH = BACKEND_DIR / "event_taxonomy.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Configure SQLite for better concurrency and performance
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Logging for better concurrency
    cursor.execute("PRAGMA synchronous=NORMAL")  # Faster while still safe
    cursor.execute("PRAGMA temp_store=MEMORY")  # Store temp tables in memory
    cursor.execute("PRAGMA mmap_size=268435456")  # 256MB memory-mapped I/O for performance
    cursor.execute("PRAGMA page_size=4096")  # Optimal page size
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    data_type = Column(String, nullable=False)  # Float, Int, String, List, JSON
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)

    event_properties = relationship("EventProperty", back_populates="property")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)

    event_properties = relationship("EventProperty", back_populates="event", cascade="all, delete-orphan")


class EventProperty(Base):
    __tablename__ = "event_properties"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    property_type = Column(String, nullable=False)  # 'event', 'user', 'super'
    is_required = Column(Boolean, default=False)
    example_value = Column(Text)

    event = relationship("Event", back_populates="event_properties")
    property = relationship("Property", back_populates="event_properties")


class Changelog(Base):
    __tablename__ = "changelog"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # 'event', 'property', 'event_property'
    entity_id = Column(Integer, nullable=False, index=True)
    action = Column(String, nullable=False)  # 'create', 'update', 'delete'
    old_value = Column(JSON)
    new_value = Column(JSON)
    changed_by = Column(String)
    changed_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Create FTS5 virtual table for full-text search on events
    with engine.connect() as conn:
        # Check if FTS5 table exists
        result = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='events_fts'")
        )
        if not result.fetchone():
            # Create FTS5 virtual table
            conn.execute(text("""
                CREATE VIRTUAL TABLE events_fts USING fts5(
                    event_id UNINDEXED,
                    name,
                    description,
                    category,
                    content='events',
                    content_rowid='id'
                )
            """))
            
            # Populate FTS5 table with existing data
            conn.execute(text("""
                INSERT INTO events_fts(event_id, name, description, category)
                SELECT id, name, COALESCE(description, ''), COALESCE(category, '')
                FROM events
            """))
            
            # Create triggers to keep FTS5 in sync
            # Insert trigger
            conn.execute(text("""
                CREATE TRIGGER events_fts_insert AFTER INSERT ON events BEGIN
                    INSERT INTO events_fts(event_id, name, description, category)
                    VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
                END
            """))
            
            # Update trigger
            conn.execute(text("""
                CREATE TRIGGER events_fts_update AFTER UPDATE ON events BEGIN
                    UPDATE events_fts 
                    SET name = new.name,
                        description = COALESCE(new.description, ''),
                        category = COALESCE(new.category, '')
                    WHERE event_id = new.id;
                END
            """))
            
            # Delete trigger
            conn.execute(text("""
                CREATE TRIGGER events_fts_delete AFTER DELETE ON events BEGIN
                    DELETE FROM events_fts WHERE event_id = old.id;
                END
            """))
            
            conn.commit()

