from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


PropertyDataType = Literal["String", "Int", "Float", "Boolean", "List", "JSON"]
PropertyType = Literal["event", "user", "super"]


class PropertyBase(BaseModel):
    name: str
    data_type: PropertyDataType
    description: Optional[str] = None
    created_by: Optional[str] = None


class PropertyCreate(PropertyBase):
    pass


class PropertyResponse(PropertyBase):
    id: int
    # Response remains permissive so legacy rows don't 500 on read.
    data_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventPropertyBase(BaseModel):
    property_id: int
    property_type: PropertyType
    is_required: bool = False
    example_value: Optional[str] = None


class EventPropertyCreate(BaseModel):
    property_name: str
    property_type: PropertyType
    data_type: PropertyDataType
    is_required: bool = False
    example_value: Optional[str] = None
    description: Optional[str] = None


class EventPropertyResponse(EventPropertyBase):
    id: int
    property_name: str
    # Response remains permissive so legacy rows don't 500 on read.
    property_type: str
    data_type: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    created_by: Optional[str] = None


class EventCreate(EventBase):
    properties: List[EventPropertyCreate] = Field(default_factory=list)

    @field_validator("properties", mode="before")
    @classmethod
    def normalize_properties(cls, value):
        if value is None:
            return []
        return value


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class EventResponse(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    properties: List[EventPropertyResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ChangelogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    action: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    changed_by: Optional[str] = None
    changed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PropertySuggestion(BaseModel):
    name: str
    data_type: str
    similarity: float
