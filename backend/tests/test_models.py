import pytest
from datetime import datetime
from pydantic import ValidationError

from models import (
    PropertyCreate, EventCreate, EventUpdate, EventPropertyCreate,
    ChangelogResponse
)


class TestPropertyModels:
    """Test property Pydantic models."""

    def test_property_create_valid(self):
        """Test creating a valid PropertyCreate model."""
        prop = PropertyCreate(
            name="test_prop",
            data_type="String",
            description="Test property",
            created_by="pytest"
        )
        assert prop.name == "test_prop"
        assert prop.data_type == "String"
        assert prop.description == "Test property"
        assert prop.created_by == "pytest"

    def test_property_create_minimal(self):
        """Test creating PropertyCreate with minimal fields."""
        prop = PropertyCreate(name="test_prop", data_type="String")
        assert prop.name == "test_prop"
        assert prop.data_type == "String"
        assert prop.description is None
        assert prop.created_by is None

    def test_property_create_missing_required(self):
        """Test PropertyCreate fails without required fields."""
        with pytest.raises(ValidationError):
            PropertyCreate(name="test_prop")  # Missing data_type


class TestEventPropertyModels:
    """Test event-property association models."""

    def test_event_property_create_valid(self):
        """Test creating a valid EventPropertyCreate model."""
        ep = EventPropertyCreate(
            property_name="test_prop",
            property_type="event",
            data_type="String",
            is_required=True,
            example_value="example",
            description="Test property"
        )
        assert ep.property_name == "test_prop"
        assert ep.property_type == "event"
        assert ep.data_type == "String"
        assert ep.is_required is True
        assert ep.example_value == "example"

    def test_event_property_create_defaults(self):
        """Test EventPropertyCreate default values."""
        ep = EventPropertyCreate(
            property_name="test_prop",
            property_type="event",
            data_type="String"
        )
        assert ep.is_required is False
        assert ep.example_value is None
        assert ep.description is None


class TestEventModels:
    """Test event Pydantic models."""

    def test_event_create_valid(self):
        """Test creating a valid EventCreate model."""
        event = EventCreate(
            name="Test Event",
            description="A test event",
            category="Testing",
            created_by="pytest",
            properties=[
                EventPropertyCreate(
                    property_name="test_prop",
                    property_type="event",
                    data_type="String"
                )
            ]
        )
        assert event.name == "Test Event"
        assert event.description == "A test event"
        assert event.category == "Testing"
        assert len(event.properties) == 1

    def test_event_create_minimal(self):
        """Test creating EventCreate with minimal fields."""
        event = EventCreate(name="Test Event")
        assert event.name == "Test Event"
        assert event.description is None
        assert event.category is None
        assert event.created_by is None
        assert event.properties == []

    def test_event_update_partial(self):
        """Test EventUpdate allows partial updates."""
        update = EventUpdate(name="Updated Name")
        assert update.name == "Updated Name"
        assert update.description is None
        assert update.category is None

    def test_event_update_all_fields(self):
        """Test EventUpdate with all fields."""
        update = EventUpdate(
            name="Updated Name",
            description="Updated description",
            category="Updated Category"
        )
        assert update.name == "Updated Name"
        assert update.description == "Updated description"
        assert update.category == "Updated Category"


class TestChangelogModels:
    """Test changelog Pydantic models."""

    def test_changelog_response_valid(self):
        """Test ChangelogResponse model."""
        changelog = ChangelogResponse(
            id=1,
            entity_type="event",
            entity_id=1,
            action="create",
            old_value=None,
            new_value={"name": "Test Event"},
            changed_by="pytest",
            changed_at=datetime.now()
        )
        assert changelog.id == 1
        assert changelog.entity_type == "event"
        assert changelog.action == "create"
        assert changelog.new_value == {"name": "Test Event"}
