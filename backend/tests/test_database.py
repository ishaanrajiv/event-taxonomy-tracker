import pytest
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, Event, Property, EventProperty, Changelog


@pytest.fixture
def db_session():
    """Create a test database session."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


class TestPropertyModel:
    """Test Property database model."""

    def test_create_property(self, db_session):
        """Test creating a property."""
        prop = Property(
            name="test_property",
            data_type="String",
            description="Test description",
            created_by="pytest"
        )
        db_session.add(prop)
        db_session.commit()
        db_session.refresh(prop)

        assert prop.id is not None
        assert prop.name == "test_property"
        assert prop.data_type == "String"
        assert prop.description == "Test description"
        assert prop.created_by == "pytest"
        assert isinstance(prop.created_at, datetime)

    def test_property_unique_name(self, db_session):
        """Test that property names must be unique."""
        prop1 = Property(name="unique_prop", data_type="String")
        db_session.add(prop1)
        db_session.commit()

        prop2 = Property(name="unique_prop", data_type="Integer")
        db_session.add(prop2)

        with pytest.raises(Exception):  # IntegrityError
            db_session.commit()


class TestEventModel:
    """Test Event database model."""

    def test_create_event(self, db_session):
        """Test creating an event."""
        event = Event(
            name="Test Event",
            description="Test description",
            category="Testing",
            created_by="pytest"
        )
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)

        assert event.id is not None
        assert event.name == "Test Event"
        assert event.description == "Test description"
        assert event.category == "Testing"
        assert event.created_by == "pytest"
        assert isinstance(event.created_at, datetime)
        assert isinstance(event.updated_at, datetime)

    def test_event_minimal(self, db_session):
        """Test creating an event with minimal fields."""
        event = Event(name="Minimal Event")
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)

        assert event.id is not None
        assert event.name == "Minimal Event"
        assert event.description is None
        assert event.category is None


class TestEventPropertyModel:
    """Test EventProperty association model."""

    def test_create_event_property(self, db_session):
        """Test creating an event-property association."""
        # Create property
        prop = Property(name="test_prop", data_type="String")
        db_session.add(prop)
        db_session.commit()

        # Create event
        event = Event(name="Test Event")
        db_session.add(event)
        db_session.commit()

        # Create association
        ep = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_type="event",
            is_required=True,
            example_value="example"
        )
        db_session.add(ep)
        db_session.commit()
        db_session.refresh(ep)

        assert ep.id is not None
        assert ep.event_id == event.id
        assert ep.property_id == prop.id
        assert ep.property_type == "event"
        assert ep.is_required is True
        assert ep.example_value == "example"

    def test_event_property_cascade_delete(self, db_session):
        """Test that deleting an event cascades to event_properties."""
        # Create property
        prop = Property(name="test_prop", data_type="String")
        db_session.add(prop)
        db_session.commit()

        # Create event with property
        event = Event(name="Test Event")
        db_session.add(event)
        db_session.commit()

        ep = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_type="event"
        )
        db_session.add(ep)
        db_session.commit()

        ep_id = ep.id

        # Delete event
        db_session.delete(event)
        db_session.commit()

        # EventProperty should be deleted
        deleted_ep = db_session.query(EventProperty).filter(EventProperty.id == ep_id).first()
        assert deleted_ep is None


class TestChangelogModel:
    """Test Changelog database model."""

    def test_create_changelog(self, db_session):
        """Test creating a changelog entry."""
        changelog = Changelog(
            entity_type="event",
            entity_id=1,
            action="create",
            old_value=None,
            new_value={"name": "Test Event"},
            changed_by="pytest"
        )
        db_session.add(changelog)
        db_session.commit()
        db_session.refresh(changelog)

        assert changelog.id is not None
        assert changelog.entity_type == "event"
        assert changelog.entity_id == 1
        assert changelog.action == "create"
        assert changelog.old_value is None
        assert changelog.new_value == {"name": "Test Event"}
        assert changelog.changed_by == "pytest"
        assert isinstance(changelog.changed_at, datetime)

    def test_changelog_json_fields(self, db_session):
        """Test that JSON fields work correctly."""
        old_val = {"name": "Old", "category": "Test"}
        new_val = {"name": "New", "category": "Updated"}

        changelog = Changelog(
            entity_type="event",
            entity_id=1,
            action="update",
            old_value=old_val,
            new_value=new_val,
            changed_by="pytest"
        )
        db_session.add(changelog)
        db_session.commit()
        db_session.refresh(changelog)

        assert changelog.old_value == old_val
        assert changelog.new_value == new_val


class TestRelationships:
    """Test database model relationships."""

    def test_event_properties_relationship(self, db_session):
        """Test Event -> EventProperty relationship."""
        event = Event(name="Test Event")
        db_session.add(event)
        db_session.commit()

        prop = Property(name="test_prop", data_type="String")
        db_session.add(prop)
        db_session.commit()

        ep = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_type="event"
        )
        db_session.add(ep)
        db_session.commit()

        # Access relationship
        db_session.refresh(event)
        assert len(event.event_properties) == 1
        assert event.event_properties[0].property_id == prop.id

    def test_property_event_properties_relationship(self, db_session):
        """Test Property -> EventProperty relationship."""
        prop = Property(name="test_prop", data_type="String")
        db_session.add(prop)
        db_session.commit()

        event = Event(name="Test Event")
        db_session.add(event)
        db_session.commit()

        ep = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_type="event"
        )
        db_session.add(ep)
        db_session.commit()

        # Access relationship
        db_session.refresh(prop)
        assert len(prop.event_properties) == 1
        assert prop.event_properties[0].event_id == event.id
