from datetime import datetime

from utils import find_similar_properties, object_to_dict


class TestFindSimilarProperties:
    """Test the fuzzy property matching function."""

    def test_find_similar_properties_exact_match(self):
        """Test that exact matches are excluded."""
        existing = [("user_id", "String"), ("session_id", "String")]
        suggestions = find_similar_properties("user_id", existing)
        # Exact match should be excluded
        assert len(suggestions) == 0 or all(s["name"] != "user_id" for s in suggestions)

    def test_find_similar_properties_close_match(self):
        """Test finding close matches."""
        existing = [
            ("user_id", "String"),
            ("user_name", "String"),
            ("username", "String"),
            ("product_id", "Integer")
        ]
        suggestions = find_similar_properties("userid", existing, threshold=0.6)
        # Should find user_id, username as similar
        assert len(suggestions) > 0
        assert suggestions[0]["name"] in ["user_id", "username"]
        assert "similarity" in suggestions[0]
        assert "data_type" in suggestions[0]

    def test_find_similar_properties_no_matches(self):
        """Test when no similar properties found."""
        existing = [("user_id", "String"), ("session_id", "String")]
        suggestions = find_similar_properties("completely_different", existing, threshold=0.8)
        assert len(suggestions) == 0

    def test_find_similar_properties_case_insensitive(self):
        """Test that matching is case insensitive."""
        existing = [("UserId", "String"), ("USER_NAME", "String")]
        # Using "user" instead of "userid" - should match both with lower threshold
        suggestions = find_similar_properties("user", existing, threshold=0.5)
        assert len(suggestions) > 0
        # Should find UserId or USER_NAME
        assert any(s["name"] in ["UserId", "USER_NAME"] for s in suggestions)

    def test_find_similar_properties_sorted_by_similarity(self):
        """Test that results are sorted by similarity score."""
        existing = [
            ("user", "String"),
            ("user_id", "String"),
            ("username", "String"),
            ("product", "String")
        ]
        suggestions = find_similar_properties("user", existing, threshold=0.0)
        # Results should be sorted by similarity (descending)
        if len(suggestions) > 1:
            for i in range(len(suggestions) - 1):
                assert suggestions[i]["similarity"] >= suggestions[i + 1]["similarity"]

    def test_find_similar_properties_max_five_results(self):
        """Test that at most 5 results are returned."""
        existing = [
            (f"user_{i}", "String") for i in range(20)
        ]
        suggestions = find_similar_properties("user", existing, threshold=0.0)
        assert len(suggestions) <= 5

    def test_find_similar_properties_threshold(self):
        """Test that threshold is respected."""
        existing = [
            ("user_id", "String"),
            ("xyz", "String")
        ]
        suggestions = find_similar_properties("user", existing, threshold=0.9)
        # "xyz" should not match with high threshold
        assert all(s["similarity"] > 0.9 for s in suggestions)

    def test_find_similar_properties_includes_data_type(self):
        """Test that data type is included in results."""
        existing = [
            ("user_id", "String"),
            ("count", "Integer")
        ]
        suggestions = find_similar_properties("user", existing, threshold=0.5)
        for suggestion in suggestions:
            assert "data_type" in suggestion
            assert suggestion["data_type"] in ["String", "Integer"]


class TestObjectToDict:
    """Test the SQLAlchemy object to dict converter."""

    class MockObject:
        """Mock SQLAlchemy object for testing."""
        class MockTable:
            class MockColumn:
                def __init__(self, name):
                    self.name = name

            columns = [
                MockColumn("id"),
                MockColumn("name"),
                MockColumn("created_at"),
                MockColumn("updated_at"),
                MockColumn("value")
            ]

        __table__ = MockTable()

        def __init__(self):
            self.id = 1
            self.name = "Test"
            self.created_at = datetime(2024, 1, 1, 12, 0, 0)
            self.updated_at = datetime(2024, 1, 2, 12, 0, 0)
            self.value = "test_value"

    def test_object_to_dict_default_exclude(self):
        """Test that created_at and updated_at are excluded by default."""
        obj = self.MockObject()
        result = object_to_dict(obj)
        assert "id" in result
        assert "name" in result
        assert "value" in result
        assert "created_at" not in result
        assert "updated_at" not in result

    def test_object_to_dict_custom_exclude(self):
        """Test custom exclude fields."""
        obj = self.MockObject()
        result = object_to_dict(obj, exclude_fields={"id", "value"})
        assert "id" not in result
        assert "value" not in result
        assert "name" in result
        assert "created_at" in result
        assert "updated_at" in result

    def test_object_to_dict_datetime_conversion(self):
        """Test that datetime objects are converted to ISO format."""
        obj = self.MockObject()
        result = object_to_dict(obj, exclude_fields=set())
        assert isinstance(result["created_at"], str)
        assert "2024-01-01" in result["created_at"]

    def test_object_to_dict_values(self):
        """Test that values are correctly extracted."""
        obj = self.MockObject()
        result = object_to_dict(obj)
        assert result["id"] == 1
        assert result["name"] == "Test"
        assert result["value"] == "test_value"
