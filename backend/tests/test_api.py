from fastapi import status


class TestEventEndpoints:
    """Test event CRUD operations."""

    def test_create_event(self, client, sample_event_data):
        """Test creating a new event."""
        response = client.post("/api/events", json=sample_event_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == sample_event_data["name"]
        assert data["description"] == sample_event_data["description"]
        assert data["category"] == sample_event_data["category"]
        assert len(data["properties"]) == 1
        assert data["properties"][0]["property_name"] == "test_property"

    def test_list_events(self, client, sample_event_data):
        """Test listing all events."""
        # Create an event first
        client.post("/api/events", json=sample_event_data)

        # List events
        response = client.get("/api/events")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == sample_event_data["name"]

    def test_get_event(self, client, sample_event_data):
        """Test getting a specific event."""
        # Create an event
        create_response = client.post("/api/events", json=sample_event_data)
        event_id = create_response.json()["id"]

        # Get the event
        response = client.get(f"/api/events/{event_id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == event_id
        assert data["name"] == sample_event_data["name"]

    def test_get_nonexistent_event(self, client):
        """Test getting an event that doesn't exist."""
        response = client.get("/api/events/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_event(self, client, sample_event_data):
        """Test updating an event."""
        # Create an event
        create_response = client.post("/api/events", json=sample_event_data)
        event_id = create_response.json()["id"]

        # Update the event
        update_data = {
            "name": "Updated Event",
            "description": "Updated description",
            "category": "Updated"
        }
        response = client.put(
            f"/api/events/{event_id}?changed_by=pytest",
            json=update_data
        )
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Event"
        assert data["description"] == "Updated description"
        assert data["category"] == "Updated"

    def test_delete_event(self, client, sample_event_data):
        """Test deleting an event."""
        # Create an event
        create_response = client.post("/api/events", json=sample_event_data)
        event_id = create_response.json()["id"]

        # Delete the event
        response = client.delete(f"/api/events/{event_id}?changed_by=pytest")
        assert response.status_code == status.HTTP_200_OK
        assert "message" in response.json()

        # Verify it's deleted
        get_response = client.get(f"/api/events/{event_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_search_events(self, client, sample_event_data):
        """Test searching events."""
        # Create an event
        client.post("/api/events", json=sample_event_data)

        # Search by name
        response = client.get("/api/events?q=Test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert "Test" in data[0]["name"]

    def test_filter_events_by_category(self, client, sample_event_data):
        """Test filtering events by category."""
        # Create an event
        client.post("/api/events", json=sample_event_data)

        # Filter by category
        response = client.get(f"/api/events?category={sample_event_data['category']}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert all(e["category"] == sample_event_data["category"] for e in data)


class TestPropertyEndpoints:
    """Test property CRUD operations."""

    def test_create_property(self, client, sample_property_data):
        """Test creating a new property."""
        response = client.post("/api/properties", json=sample_property_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == sample_property_data["name"]
        assert data["data_type"] == sample_property_data["data_type"]

    def test_create_duplicate_property(self, client, sample_property_data):
        """Test creating a duplicate property should fail."""
        # Create first property
        client.post("/api/properties", json=sample_property_data)

        # Try to create duplicate
        response = client.post("/api/properties", json=sample_property_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_properties(self, client, sample_property_data):
        """Test listing all properties."""
        # Create a property
        client.post("/api/properties", json=sample_property_data)

        # List properties
        response = client.get("/api/properties")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1

    def test_suggest_properties(self, client, sample_property_data):
        """Test property suggestions."""
        # Create a property
        client.post("/api/properties", json=sample_property_data)

        # Get suggestions
        response = client.get("/api/properties/suggest?q=test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "query" in data
        assert "suggestions" in data


class TestEventPropertyEndpoints:
    """Test event-property association operations."""

    def test_add_property_to_event(self, client, sample_event_data):
        """Test adding a property to an existing event."""
        # Create an event
        create_response = client.post("/api/events", json=sample_event_data)
        event_id = create_response.json()["id"]

        # Add another property
        new_property = {
            "property_name": "another_property",
            "property_type": "user",
            "data_type": "Integer",
            "is_required": False,
            "example_value": "123",
            "description": "Another test property"
        }
        response = client.post(
            f"/api/events/{event_id}/properties?changed_by=pytest",
            json=new_property
        )
        assert response.status_code == status.HTTP_200_OK

    def test_remove_property_from_event(self, client, sample_event_data):
        """Test removing a property from an event."""
        # Create an event with a property
        create_response = client.post("/api/events", json=sample_event_data)
        event_id = create_response.json()["id"]
        event_property_id = create_response.json()["properties"][0]["id"]

        # Remove the property
        response = client.delete(
            f"/api/events/{event_id}/properties/{event_property_id}?changed_by=pytest"
        )
        assert response.status_code == status.HTTP_200_OK


class TestChangelogEndpoints:
    """Test changelog operations."""

    def test_get_changelog(self, client, sample_event_data):
        """Test retrieving changelog."""
        # Create an event (should log a change)
        client.post("/api/events", json=sample_event_data)

        # Get changelog
        response = client.get("/api/changelog")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1
        assert data[0]["action"] == "create"

    def test_filter_changelog_by_entity_type(self, client, sample_event_data):
        """Test filtering changelog by entity type."""
        # Create an event
        client.post("/api/events", json=sample_event_data)

        # Get event changelog
        response = client.get("/api/changelog?entity_type=event")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(entry["entity_type"] == "event" for entry in data)


class TestSearchEndpoint:
    """Test global search functionality."""

    def test_global_search(self, client, sample_event_data, sample_property_data):
        """Test global search across events and properties."""
        # Create an event and property
        client.post("/api/events", json=sample_event_data)
        client.post("/api/properties", json=sample_property_data)

        # Search
        response = client.get("/api/search?q=test")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "query" in data
        assert "events" in data
        assert "properties" in data


class TestFeatureEndpoints:
    """Test feature/category endpoints."""

    def test_get_features(self, client, sample_event_data):
        """Test getting unique features."""
        # Create an event
        client.post("/api/events", json=sample_event_data)

        # Get features
        response = client.get("/api/features")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "recent" in data
        assert "all" in data
        assert "default" in data

    def test_get_filter_options(self, client, sample_event_data):
        """Test getting filter options."""
        # Create an event
        client.post("/api/events", json=sample_event_data)

        # Get filter options
        response = client.get("/api/filter-options")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "categories" in data
        assert "creators" in data
        assert "date_range" in data


class TestBulkOperations:
    """Test bulk import/export operations."""

    def test_download_json_template(self, client):
        """Test downloading JSON template."""
        response = client.get("/api/export/template/json")
        assert response.status_code == status.HTTP_200_OK
        assert response.headers["content-type"] == "application/json"

    def test_download_csv_template(self, client):
        """Test downloading CSV template."""
        response = client.get("/api/export/template/csv")
        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response.headers["content-type"]


class TestRootEndpoint:
    """Test root endpoint."""

    def test_root(self, client):
        """Test root endpoint returns API info."""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert "version" in data
