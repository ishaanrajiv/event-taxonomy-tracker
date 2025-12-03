from difflib import SequenceMatcher
from typing import List, Tuple
from datetime import datetime


def find_similar_properties(query: str, existing: List[Tuple[str, str]], threshold: float = 0.6) -> List[dict]:
    """
    Find similar property names using fuzzy matching.

    Args:
        query: The property name to search for
        existing: List of tuples (name, data_type) from existing properties
        threshold: Minimum similarity ratio (0.0 to 1.0)

    Returns:
        List of suggestions sorted by similarity score
    """
    suggestions = []
    for name, data_type in existing:
        ratio = SequenceMatcher(None, query.lower(), name.lower()).ratio()
        if ratio > threshold and query.lower() != name.lower():
            suggestions.append({
                "name": name,
                "data_type": data_type,
                "similarity": round(ratio, 3)
            })

    return sorted(suggestions, key=lambda x: -x["similarity"])[:5]


def object_to_dict(obj, exclude_fields=None):
    """Convert SQLAlchemy object to dictionary for changelog."""
    if exclude_fields is None:
        exclude_fields = {'created_at', 'updated_at'}

    result = {}
    for column in obj.__table__.columns:
        if column.name not in exclude_fields:
            value = getattr(obj, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            else:
                result[column.name] = value
    return result
