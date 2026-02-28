from datetime import datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, Event, EventProperty, EventVersion, Property


@pytest.fixture
def db_session():
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
        engine.dispose()


class TestPropertyModel:
    def test_create_property(self, db_session):
        prop = Property(
            name="test_property",
            data_type="String",
            description="Test description",
            created_by="pytest",
        )
        db_session.add(prop)
        db_session.commit()
        db_session.refresh(prop)

        assert prop.id is not None
        assert prop.name == "test_property"
        assert prop.data_type == "String"
        assert prop.created_by == "pytest"
        assert isinstance(prop.created_at, datetime)

    def test_property_unique_name(self, db_session):
        db_session.add(Property(name="unique_prop", data_type="String"))
        db_session.commit()

        db_session.add(Property(name="unique_prop", data_type="Int"))
        with pytest.raises(Exception):
            db_session.commit()


class TestEventModel:
    def test_create_event_defaults(self, db_session):
        event = Event(
            name="Test Event",
            description="Test description",
            category="Testing",
            created_by="pytest",
        )
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)

        assert event.id is not None
        assert event.current_version_number == 0
        assert event.current_version_id is None
        assert event.is_archived is False
        assert event.lock_version == 0
        assert isinstance(event.created_at, datetime)
        assert isinstance(event.updated_at, datetime)


class TestEventPropertyModel:
    def test_create_event_property_projection(self, db_session):
        prop = Property(name="test_prop", data_type="String")
        event = Event(name="Test Event")
        db_session.add_all([prop, event])
        db_session.commit()

        projection = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_name="test_prop",
            property_type="event",
            data_type="String",
            description="Projected description",
            is_required=True,
            example_value="example",
        )
        db_session.add(projection)
        db_session.commit()
        db_session.refresh(projection)

        assert projection.id is not None
        assert projection.property_name == "test_prop"
        assert projection.data_type == "String"
        assert projection.is_required is True

    def test_event_property_unique_live_key(self, db_session):
        prop = Property(name="test_prop", data_type="String")
        event = Event(name="Test Event")
        db_session.add_all([prop, event])
        db_session.commit()

        db_session.add(
            EventProperty(
                event_id=event.id,
                property_id=prop.id,
                property_name="test_prop",
                property_type="event",
                data_type="String",
            )
        )
        db_session.commit()

        db_session.add(
            EventProperty(
                event_id=event.id,
                property_id=prop.id,
                property_name="test_prop",
                property_type="event",
                data_type="String",
            )
        )
        with pytest.raises(Exception):
            db_session.commit()


class TestEventVersionModel:
    def test_create_event_version(self, db_session):
        event = Event(name="Test Event", current_version_number=0)
        db_session.add(event)
        db_session.commit()
        db_session.refresh(event)

        version = EventVersion(
            event_id=event.id,
            version_number=1,
            action="create",
            summary="Created event with 0 properties",
            snapshot={"event": {"name": "Test Event", "is_archived": False}, "properties": []},
            diff={"metadata": {}, "properties": {"added": [], "removed": [], "updated": []}},
            checksum="abc123",
            created_by="pytest",
        )
        db_session.add(version)
        db_session.commit()
        db_session.refresh(version)

        assert version.id is not None
        assert version.version_number == 1
        assert version.action == "create"
        assert isinstance(version.created_at, datetime)

    def test_event_version_unique_number_per_event(self, db_session):
        event = Event(name="Test Event")
        db_session.add(event)
        db_session.commit()

        db_session.add_all(
            [
                EventVersion(
                    event_id=event.id,
                    version_number=1,
                    action="create",
                    summary="Created",
                    snapshot={"event": {"name": "Test Event", "is_archived": False}, "properties": []},
                    diff={"metadata": {}, "properties": {"added": [], "removed": [], "updated": []}},
                    checksum="one",
                ),
                EventVersion(
                    event_id=event.id,
                    version_number=1,
                    action="update",
                    summary="Updated",
                    snapshot={"event": {"name": "Test Event", "is_archived": False}, "properties": []},
                    diff={"metadata": {}, "properties": {"added": [], "removed": [], "updated": []}},
                    checksum="two",
                ),
            ]
        )
        with pytest.raises(Exception):
            db_session.commit()


class TestRelationships:
    def test_event_relationships(self, db_session):
        prop = Property(name="cart_id", data_type="String")
        event = Event(name="Checkout Started")
        db_session.add_all([prop, event])
        db_session.commit()

        projection = EventProperty(
            event_id=event.id,
            property_id=prop.id,
            property_name="cart_id",
            property_type="event",
            data_type="String",
        )
        version = EventVersion(
            event_id=event.id,
            version_number=1,
            action="create",
            summary="Created",
            snapshot={"event": {"name": "Checkout Started", "is_archived": False}, "properties": []},
            diff={"metadata": {}, "properties": {"added": [], "removed": [], "updated": []}},
            checksum="abc123",
        )
        db_session.add_all([projection, version])
        db_session.commit()

        db_session.refresh(event)
        assert len(event.event_properties) == 1
        assert len(event.versions) == 1
