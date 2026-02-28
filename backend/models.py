from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


PropertyDataType = Literal["String", "Int", "Float", "Boolean", "List", "JSON"]
PropertyType = Literal["event", "user", "super"]
VersionAction = Literal["create", "update", "archive", "restore", "revert"]


class PropertyBase(BaseModel):
    name: str
    data_type: PropertyDataType
    description: Optional[str] = None
    created_by: Optional[str] = None


class PropertyCreate(PropertyBase):
    pass


class PropertyResponse(PropertyBase):
    id: int
    data_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventWriteProperty(BaseModel):
    property_name: str
    property_type: PropertyType
    data_type: PropertyDataType
    is_required: bool = False
    example_value: Optional[str] = None
    description: Optional[str] = None

    @field_validator("property_name")
    @classmethod
    def normalize_property_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("property_name must not be empty")
        return normalized


class EventPropertyResponse(EventWriteProperty):
    id: int
    property_id: Optional[int] = None
    property_type: str
    data_type: str

    model_config = ConfigDict(from_attributes=True)


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("name must not be empty")
        return normalized


class EventCreate(EventBase):
    created_by: Optional[str] = None
    change_reason: Optional[str] = None
    properties: List[EventWriteProperty] = Field(default_factory=list)

    @field_validator("properties", mode="before")
    @classmethod
    def normalize_properties(cls, value):
        if value is None:
            return []
        return value


class EventUpsertRequest(EventBase):
    base_version_number: int = Field(ge=1)
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None
    properties: List[EventWriteProperty] = Field(default_factory=list)

    @field_validator("properties", mode="before")
    @classmethod
    def normalize_properties(cls, value):
        if value is None:
            return []
        return value


class EventArchiveRequest(BaseModel):
    base_version_number: int = Field(ge=1)
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None


class EventRevertRequest(BaseModel):
    base_version_number: int = Field(ge=1)
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None


class EventResponse(EventBase):
    id: int
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    version_number: int
    is_archived: bool
    archived_at: Optional[datetime] = None
    archived_by: Optional[str] = None
    lock_version: int
    properties: List[EventPropertyResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class EventVersionSummaryResponse(BaseModel):
    id: int
    event_id: int
    event_name: str
    version_number: int
    action: str
    summary: str
    change_reason: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    parent_version_number: Optional[int] = None
    reverted_from_version_number: Optional[int] = None
    is_current: bool

    model_config = ConfigDict(from_attributes=True)


class EventVersionDetailResponse(EventVersionSummaryResponse):
    checksum: str
    snapshot: dict[str, Any]
    diff: dict[str, Any]


class ChangelogResponse(BaseModel):
    id: int
    entity_type: str
    entity_id: int
    event_name: str
    version_number: int
    action: str
    summary: str
    change_reason: Optional[str] = None
    diff: dict[str, Any]
    snapshot: dict[str, Any]
    changed_by: Optional[str] = None
    changed_at: datetime
    is_current: bool


class PropertySuggestion(BaseModel):
    name: str
    data_type: str
    similarity: float
