from datetime import datetime

import pytest
from pydantic import ValidationError

from models import (
    ChangelogResponse,
    EventArchiveRequest,
    EventCreate,
    EventRevertRequest,
    EventUpsertRequest,
    EventVersionDetailResponse,
    EventWriteProperty,
    PropertyCreate,
)


class TestPropertyModels:
    def test_property_create_valid(self):
        prop = PropertyCreate(
            name="test_prop",
            data_type="String",
            description="Test property",
            created_by="pytest",
        )
        assert prop.name == "test_prop"
        assert prop.data_type == "String"
        assert prop.description == "Test property"
        assert prop.created_by == "pytest"

    def test_property_create_missing_required(self):
        with pytest.raises(ValidationError):
            PropertyCreate(name="test_prop")


class TestEventWritePropertyModels:
    def test_event_write_property_valid(self):
        prop = EventWriteProperty(
            property_name=" user_id ",
            property_type="event",
            data_type="String",
            is_required=True,
            example_value="abc123",
            description="User identifier",
        )
        assert prop.property_name == "user_id"
        assert prop.is_required is True

    def test_event_write_property_rejects_blank_name(self):
        with pytest.raises(ValidationError):
            EventWriteProperty(
                property_name="   ",
                property_type="event",
                data_type="String",
            )


class TestEventModels:
    def test_event_create_valid(self):
        event = EventCreate(
            name="Test Event",
            description="A test event",
            category="Testing",
            created_by="pytest",
            properties=[
                EventWriteProperty(
                    property_name="test_prop",
                    property_type="event",
                    data_type="String",
                )
            ],
        )
        assert event.name == "Test Event"
        assert event.description == "A test event"
        assert event.category == "Testing"
        assert len(event.properties) == 1

    def test_event_create_normalizes_null_properties(self):
        event = EventCreate(name="Test Event", properties=None)
        assert event.properties == []

    def test_event_upsert_requires_base_version(self):
        with pytest.raises(ValidationError):
            EventUpsertRequest(
                name="Checkout Started",
                description="desc",
                category="Transaction",
            )

    def test_event_upsert_valid(self):
        request = EventUpsertRequest(
            name="Checkout Started",
            description="desc",
            category="Transaction",
            base_version_number=2,
            changed_by="pytest",
            properties=[],
        )
        assert request.base_version_number == 2
        assert request.changed_by == "pytest"

    def test_archive_and_revert_requests_require_positive_version(self):
        with pytest.raises(ValidationError):
            EventArchiveRequest(base_version_number=0)

        request = EventRevertRequest(base_version_number=3, changed_by="pytest")
        assert request.base_version_number == 3
        assert request.changed_by == "pytest"


class TestVersionModels:
    def test_event_version_detail_response_valid(self):
        detail = EventVersionDetailResponse(
            id=4,
            event_id=1,
            event_name="Checkout Started",
            version_number=4,
            action="revert",
            summary="Reverted to version 1",
            change_reason="undo",
            created_by="pytest",
            created_at=datetime.now(),
            parent_version_number=3,
            reverted_from_version_number=1,
            is_current=True,
            checksum="abc123",
            snapshot={"event": {"name": "Checkout Started", "is_archived": False}, "properties": []},
            diff={"metadata": {}, "properties": {"added": [], "removed": [], "updated": []}},
        )
        assert detail.version_number == 4
        assert detail.snapshot["event"]["name"] == "Checkout Started"

    def test_changelog_response_valid(self):
        changelog = ChangelogResponse(
            id=10,
            entity_type="event",
            entity_id=1,
            event_name="Checkout Started",
            version_number=2,
            action="update",
            summary="Updated 1 metadata field",
            change_reason=None,
            diff={"metadata": {"name": {"from": "A", "to": "B"}}, "properties": {"added": [], "removed": [], "updated": []}},
            snapshot={"event": {"name": "B", "is_archived": False}, "properties": []},
            changed_by="pytest",
            changed_at=datetime.now(),
            is_current=False,
        )
        assert changelog.event_name == "Checkout Started"
        assert changelog.action == "update"
