"""baseline event version control schema

Revision ID: 20260227_0001
Revises:
Create Date: 2026-02-27 17:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260227_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "properties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("data_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_properties_id"), "properties", ["id"], unique=False)
    op.create_index(op.f("ix_properties_name"), "properties", ["name"], unique=False)

    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("current_version_number", sa.Integer(), nullable=False),
        sa.Column("current_version_id", sa.Integer(), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("archived_by", sa.String(), nullable=True),
        sa.Column("lock_version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_events_category"), "events", ["category"], unique=False)
    op.create_index(op.f("ix_events_current_version_id"), "events", ["current_version_id"], unique=False)
    op.create_index(op.f("ix_events_id"), "events", ["id"], unique=False)
    op.create_index(op.f("ix_events_is_archived"), "events", ["is_archived"], unique=False)
    op.create_index(op.f("ix_events_name"), "events", ["name"], unique=False)

    op.create_table(
        "event_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("parent_version_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("summary", sa.String(), nullable=False),
        sa.Column("change_reason", sa.Text(), nullable=True),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("diff", sa.JSON(), nullable=False),
        sa.Column("checksum", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reverted_from_version_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_version_id"], ["event_versions.id"]),
        sa.ForeignKeyConstraint(["reverted_from_version_id"], ["event_versions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "version_number", name="uq_event_version_number"),
    )
    op.create_index(op.f("ix_event_versions_checksum"), "event_versions", ["checksum"], unique=False)
    op.create_index(op.f("ix_event_versions_event_id"), "event_versions", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_versions_id"), "event_versions", ["id"], unique=False)
    op.create_index(op.f("ix_event_versions_parent_version_id"), "event_versions", ["parent_version_id"], unique=False)
    op.create_index(op.f("ix_event_versions_reverted_from_version_id"), "event_versions", ["reverted_from_version_id"], unique=False)

    op.create_table(
        "event_properties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("property_name", sa.String(), nullable=False),
        sa.Column("property_type", sa.String(), nullable=False),
        sa.Column("data_type", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False),
        sa.Column("example_value", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["properties.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "property_name", "property_type", name="uq_event_live_property_key"),
    )
    op.create_index(op.f("ix_event_properties_event_id"), "event_properties", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_properties_id"), "event_properties", ["id"], unique=False)
    op.create_index(op.f("ix_event_properties_property_id"), "event_properties", ["property_id"], unique=False)
    op.create_index(op.f("ix_event_properties_property_name"), "event_properties", ["property_name"], unique=False)

    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
                name,
                description,
                category,
                content='events',
                content_rowid='id'
            )
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
                INSERT INTO events_fts(rowid, name, description, category)
                VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
            END
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, name, description, category)
                VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
                INSERT INTO events_fts(rowid, name, description, category)
                VALUES (new.id, new.name, COALESCE(new.description, ''), COALESCE(new.category, ''));
            END
            """
        )
        op.execute(
            """
            CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
                INSERT INTO events_fts(events_fts, rowid, name, description, category)
                VALUES ('delete', old.id, old.name, COALESCE(old.description, ''), COALESCE(old.category, ''));
            END
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS events_fts_delete")
        op.execute("DROP TRIGGER IF EXISTS events_fts_update")
        op.execute("DROP TRIGGER IF EXISTS events_fts_insert")
        op.execute("DROP TABLE IF EXISTS events_fts")

    op.drop_index(op.f("ix_event_properties_property_name"), table_name="event_properties")
    op.drop_index(op.f("ix_event_properties_property_id"), table_name="event_properties")
    op.drop_index(op.f("ix_event_properties_id"), table_name="event_properties")
    op.drop_index(op.f("ix_event_properties_event_id"), table_name="event_properties")
    op.drop_table("event_properties")

    op.drop_index(op.f("ix_event_versions_reverted_from_version_id"), table_name="event_versions")
    op.drop_index(op.f("ix_event_versions_parent_version_id"), table_name="event_versions")
    op.drop_index(op.f("ix_event_versions_id"), table_name="event_versions")
    op.drop_index(op.f("ix_event_versions_event_id"), table_name="event_versions")
    op.drop_index(op.f("ix_event_versions_checksum"), table_name="event_versions")
    op.drop_table("event_versions")

    op.drop_index(op.f("ix_events_name"), table_name="events")
    op.drop_index(op.f("ix_events_is_archived"), table_name="events")
    op.drop_index(op.f("ix_events_id"), table_name="events")
    op.drop_index(op.f("ix_events_current_version_id"), table_name="events")
    op.drop_index(op.f("ix_events_category"), table_name="events")
    op.drop_table("events")

    op.drop_index(op.f("ix_properties_name"), table_name="properties")
    op.drop_index(op.f("ix_properties_id"), table_name="properties")
    op.drop_table("properties")
