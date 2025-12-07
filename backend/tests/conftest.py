import pytest
import sys
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Add backend directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))
from database import Base, get_db # noqa: E402
from api import app # noqa: E402




@pytest.fixture(scope="function")
def test_db():
    """Create a fresh test database for each test."""
    # Use in-memory SQLite database
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create tables
    Base.metadata.create_all(bind=engine)

    # Create FTS5 table for search tests
    from sqlalchemy import text
    with engine.connect() as conn:
        # Create FTS5 virtual table
        conn.execute(text("""
            CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
                name,
                description,
                category,
                content='events',
                content_rowid='id'
            )
        """))

        # Create triggers to keep FTS5 in sync
        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
                INSERT INTO events_fts(rowid, name, description, category)
                VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
            END
        """))

        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, name, description, category)
                VALUES ('delete', old.id, old.name, old.description, old.category);
                INSERT INTO events_fts(rowid, name, description, category)
                VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
            END
        """))

        conn.execute(text("""
            CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, name, description, category)
                VALUES ('delete', old.id, old.name, old.description, old.category);
            END
        """))

        conn.commit()

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(test_db):
    """Create a test client with dependency override."""
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def sample_event_data():
    """Sample event data for testing."""
    return {
        "name": "Test Event",
        "description": "A test event",
        "category": "Testing",
        "created_by": "pytest",
        "properties": [
            {
                "property_name": "test_property",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "test_value",
                "description": "A test property"
            }
        ]
    }


@pytest.fixture
def sample_property_data():
    """Sample property data for testing."""
    return {
        "name": "test_prop",
        "data_type": "String",
        "description": "Test property",
        "created_by": "pytest"
    }
