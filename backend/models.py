from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class PropertyBase(BaseModel):
    name: str
    data_type: str
    description: Optional[str] = None
    created_by: Optional[str] = None


class PropertyCreate(PropertyBase):
    pass


class PropertyResponse(PropertyBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventPropertyBase(BaseModel):
    property_id: int
    property_type: str  # 'event', 'user', 'super'
    is_required: bool = False
    example_value: Optional[str] = None


class EventPropertyCreate(BaseModel):
    property_name: str
    property_type: str
    data_type: str
    is_required: bool = False
    example_value: Optional[str] = None
    description: Optional[str] = None


class EventPropertyResponse(EventPropertyBase):
    id: int
    property_name: str
    data_type: str
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    created_by: Optional[str] = None


class EventCreate(EventBase):
    properties: Optional[List[EventPropertyCreate]] = []


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None


class EventResponse(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    properties: List[EventPropertyResponse] = []

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
