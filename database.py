from sqlalchemy import create_engine, Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./event_taxonomy.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Property(Base):
    __tablename__ = "properties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    data_type = Column(String, nullable=False)  # Float, Int, String, List, JSON
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)

    event_properties = relationship("EventProperty", back_populates="property")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text)
    category = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String)

    event_properties = relationship("EventProperty", back_populates="event", cascade="all, delete-orphan")


class EventProperty(Base):
    __tablename__ = "event_properties"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    property_id = Column(Integer, ForeignKey("properties.id"), nullable=False)
    property_type = Column(String, nullable=False)  # 'event', 'user', 'super'
    is_required = Column(Boolean, default=False)
    example_value = Column(Text)

    event = relationship("Event", back_populates="event_properties")
    property = relationship("Property", back_populates="event_properties")


class Changelog(Base):
    __tablename__ = "changelog"

    id = Column(Integer, primary_key=True, index=True)
    entity_type = Column(String, nullable=False, index=True)  # 'event', 'property', 'event_property'
    entity_id = Column(Integer, nullable=False, index=True)
    action = Column(String, nullable=False)  # 'create', 'update', 'delete'
    old_value = Column(JSON)
    new_value = Column(JSON)
    changed_by = Column(String)
    changed_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
