import json

from fastapi import status

from database import Property


def build_update_payload(base_version_number: int, **overrides):
    payload = {
        "name": "Test Event",
        "description": "A test event",
        "category": "Testing",
        "base_version_number": base_version_number,
        "changed_by": "pytest",
        "properties": [
            {
                "property_name": "test_property",
                "property_type": "event",
                "data_type": "String",
                "is_required": True,
                "example_value": "test_value",
                "description": "A test property",
            }
        ],
    }
    payload.update(overrides)
    return payload


class TestEventVersionEndpoints:
    def test_create_event_creates_version_one(self, client, sample_event_data):
        response = client.post("/api/events", json=sample_event_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == sample_event_data["name"]
        assert data["version_number"] == 1
        assert data["is_archived"] is False
        assert len(data["properties"]) == 1

        versions = client.get(f"/api/events/{data['id']}/versions")
        assert versions.status_code == status.HTTP_200_OK
        version_data = versions.json()
        assert len(version_data) == 1
        assert version_data[0]["action"] == "create"
        assert version_data[0]["version_number"] == 1
        assert version_data[0]["is_current"] is True

        detail = client.get(f"/api/events/{data['id']}/versions/1")
        assert detail.status_code == status.HTTP_200_OK
        detail_data = detail.json()
        assert detail_data["snapshot"]["event"]["name"] == sample_event_data["name"]
        assert len(detail_data["diff"]["properties"]["added"]) == 1

    def test_update_event_creates_new_version_and_metadata_diff(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()

        response = client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(
                1,
                name="Updated Event",
                description="Updated description",
                category="Updated",
            ),
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version_number"] == 2
        assert data["name"] == "Updated Event"

        detail = client.get(f"/api/events/{created['id']}/versions/2").json()
        assert detail["diff"]["metadata"]["name"] == {"from": "Test Event", "to": "Updated Event"}
        assert detail["diff"]["metadata"]["category"] == {"from": "Testing", "to": "Updated"}

    def test_property_only_update_creates_property_diff(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()

        response = client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(
                1,
                properties=[
                    {
                        "property_name": "test_property",
                        "property_type": "event",
                        "data_type": "String",
                        "is_required": True,
                        "example_value": "test_value",
                        "description": "A test property",
                    },
                    {
                        "property_name": "another_property",
                        "property_type": "user",
                        "data_type": "Int",
                        "is_required": False,
                        "example_value": "123",
                        "description": "Another property",
                    },
                ],
            ),
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["version_number"] == 2
        assert len(data["properties"]) == 2

        detail = client.get(f"/api/events/{created['id']}/versions/2").json()
        assert detail["diff"]["properties"]["added"][0]["property_name"] == "another_property"
        assert detail["diff"]["properties"]["removed"] == []

    def test_noop_update_does_not_create_new_version(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()

        response = client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1),
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["version_number"] == 1

        versions = client.get(f"/api/events/{created['id']}/versions").json()
        assert len(versions) == 1

    def test_stale_base_version_returns_409(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1, description="Fresh change"),
        )

        response = client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1, description="Stale change"),
        )
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "Current version is 2" in response.json()["detail"]

    def test_archive_restore_and_archived_filters(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()

        archived = client.post(
            f"/api/events/{created['id']}/archive",
            json={"base_version_number": 1, "changed_by": "pytest", "change_reason": "cleanup"},
        )
        assert archived.status_code == status.HTTP_200_OK
        archived_data = archived.json()
        assert archived_data["is_archived"] is True
        assert archived_data["version_number"] == 2

        visible_events = client.get("/api/events").json()
        assert visible_events == []

        all_events = client.get("/api/events?include_archived=true").json()
        assert len(all_events) == 1
        assert all_events[0]["is_archived"] is True

        archived_only = client.get("/api/events?only_archived=true").json()
        assert len(archived_only) == 1
        assert archived_only[0]["id"] == created["id"]

        restored = client.post(
            f"/api/events/{created['id']}/restore",
            json={"base_version_number": 2, "changed_by": "pytest", "change_reason": "bring back"},
        )
        assert restored.status_code == status.HTTP_200_OK
        restored_data = restored.json()
        assert restored_data["is_archived"] is False
        assert restored_data["version_number"] == 3

    def test_archived_event_cannot_be_edited(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.post(
            f"/api/events/{created['id']}/archive",
            json={"base_version_number": 1, "changed_by": "pytest"},
        )

        response = client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(2, description="Should fail"),
        )
        assert response.status_code == status.HTTP_409_CONFLICT
        assert "must be restored" in response.json()["detail"]

    def test_revert_creates_new_head_version(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()

        client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1, name="Version Two"),
        )
        client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(
                2,
                name="Version Three",
                properties=[
                    {
                        "property_name": "test_property",
                        "property_type": "event",
                        "data_type": "String",
                        "is_required": True,
                        "example_value": "test_value",
                        "description": "A test property",
                    },
                    {
                        "property_name": "cart_value",
                        "property_type": "event",
                        "data_type": "Float",
                        "is_required": False,
                        "example_value": "19.99",
                        "description": "Cart value",
                    },
                ],
            ),
        )

        reverted = client.post(
            f"/api/events/{created['id']}/versions/1/revert",
            json={"base_version_number": 3, "changed_by": "pytest", "change_reason": "undo"},
        )
        assert reverted.status_code == status.HTTP_200_OK
        reverted_data = reverted.json()
        assert reverted_data["version_number"] == 4
        assert reverted_data["name"] == "Test Event"
        assert len(reverted_data["properties"]) == 1

        versions = client.get(f"/api/events/{created['id']}/versions").json()
        assert versions[0]["action"] == "revert"
        assert versions[0]["reverted_from_version_number"] == 1

    def test_revert_with_stale_base_version_returns_409(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1, name="Version Two"),
        )

        response = client.post(
            f"/api/events/{created['id']}/versions/1/revert",
            json={"base_version_number": 1, "changed_by": "pytest"},
        )
        assert response.status_code == status.HTTP_409_CONFLICT

    def test_registry_conflict_still_returns_400(self, client):
        client.post(
            "/api/events",
            json={
                "name": "Seed Event",
                "properties": [
                    {
                        "property_name": "conflicting_prop",
                        "property_type": "event",
                        "data_type": "String",
                    }
                ],
            },
        )

        response = client.post(
            "/api/events",
            json={
                "name": "Conflicting Event",
                "properties": [
                    {
                        "property_name": "conflicting_prop",
                        "property_type": "event",
                        "data_type": "Int",
                    }
                ],
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists with data type" in response.json()["detail"]


class TestPropertyEndpoints:
    def test_create_property(self, client, sample_property_data):
        response = client.post("/api/properties", json=sample_property_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == sample_property_data["name"]
        assert data["data_type"] == sample_property_data["data_type"]

    def test_create_duplicate_property(self, client, sample_property_data):
        client.post("/api/properties", json=sample_property_data)
        response = client.post("/api/properties", json=sample_property_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_properties_tolerates_legacy_invalid_data_type(self, client, test_db):
        legacy_property = Property(name="legacy_only_prop", data_type="WeirdType")
        test_db.add(legacy_property)
        test_db.commit()

        response = client.get("/api/properties")
        assert response.status_code == status.HTTP_200_OK
        returned = next(prop for prop in response.json() if prop["name"] == "legacy_only_prop")
        assert returned["data_type"] == "WeirdType"

    def test_suggest_properties(self, client, sample_property_data):
        client.post("/api/properties", json=sample_property_data)
        response = client.get("/api/properties/suggest?q=test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["query"] == "test"
        assert "suggestions" in data


class TestChangelogAndSearchEndpoints:
    def test_changelog_reads_from_versions(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.put(
            f"/api/events/{created['id']}",
            json=build_update_payload(1, name="Updated Event"),
        )

        response = client.get("/api/changelog")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data[0]["action"] == "update"
        assert data[0]["version_number"] == 2
        assert data[1]["action"] == "create"

    def test_global_search_excludes_archived_events(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.post(
            f"/api/events/{created['id']}/archive",
            json={"base_version_number": 1, "changed_by": "pytest"},
        )

        response = client.get("/api/search?q=Test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["events"] == []

    def test_get_features_and_filter_options_ignore_archived_events(self, client, sample_event_data):
        created = client.post("/api/events", json=sample_event_data).json()
        client.post(
            f"/api/events/{created['id']}/archive",
            json={"base_version_number": 1, "changed_by": "pytest"},
        )

        features = client.get("/api/features")
        assert features.status_code == status.HTTP_200_OK
        assert features.json()["all"] == []

        filter_options = client.get("/api/filter-options")
        assert filter_options.status_code == status.HTTP_200_OK
        assert filter_options.json()["categories"] == []


class TestBulkOperations:
    def test_download_json_template(self, client):
        response = client.get("/api/export/template/json")
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/json"

    def test_download_csv_template(self, client):
        response = client.get("/api/export/template/csv")
        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response.headers["content-type"]

    def test_import_json_creates_versioned_events(self, client):
        payload = [
            {
                "name": "Imported Event",
                "description": "from json",
                "category": "Import",
                "properties": [
                    {
                        "property_name": "source",
                        "property_type": "event",
                        "data_type": "String",
                    }
                ],
            }
        ]
        response = client.post(
            "/api/import/json",
            files={"file": ("events.json", json.dumps(payload).encode("utf-8"), "application/json")},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["imported"] == 1

        events = client.get("/api/events?q=Imported").json()
        assert len(events) == 1
        versions = client.get(f"/api/events/{events[0]['id']}/versions").json()
        assert len(versions) == 1
        assert versions[0]["version_number"] == 1

    def test_import_csv_rolls_back_event_on_property_conflict(self, client):
        client.post(
            "/api/events",
            json={
                "name": "Seed Event CSV",
                "properties": [
                    {
                        "property_name": "conflicting_csv_prop",
                        "property_type": "event",
                        "data_type": "String",
                    }
                ],
            },
        )

        csv_content = (
            "event_name,event_description,event_category,property_name,property_type,data_type,is_required,example_value,property_description\n"
            "Import CSV Conflict Event,desc,Engagement,conflicting_csv_prop,event,Int,true,,\n"
        ).encode("utf-8")

        response = client.post(
            "/api/import/csv",
            files={"file": ("events.csv", csv_content, "text/csv")},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["imported"] == 0

        events = client.get("/api/events?q=Import CSV Conflict Event").json()
        assert events == []


class TestRootEndpoint:
    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Event Taxonomy Tracker API"
        assert data["version"] == "2.0.0"
