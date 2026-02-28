import { createHash } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { DuplicatePropertyError, InvalidEventStateError, RegistryConflictError, VersionConflictError } from '../errors';
import { nowIso, parseJson } from '../db';
import { stableStringify } from '../utils/stable-json';
import type {
  EventCreatePayload,
  EventDiff,
  EventPropertyRow,
  EventRow,
  EventSnapshot,
  EventUpdatePayload,
  EventVersionRow,
  NormalizedProperty,
  PropertyRow,
  VersionAction,
} from '../types';

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProperty(prop: NormalizedProperty | Record<string, unknown>): NormalizedProperty {
  const raw = prop as Record<string, unknown>;
  const propertyName = String(raw.property_name ?? '').trim();

  return {
    property_name: propertyName,
    property_type: raw.property_type as NormalizedProperty['property_type'],
    data_type: raw.data_type as NormalizedProperty['data_type'],
    description: normalizeOptionalText((raw.description as string | null | undefined) ?? null),
    is_required: Boolean(raw.is_required ?? false),
    example_value: normalizeOptionalText((raw.example_value as string | null | undefined) ?? null),
  };
}

export function normalizeProperties(
  properties: Array<NormalizedProperty | Record<string, unknown>>,
): NormalizedProperty[] {
  const normalized = properties.map((prop) => normalizeProperty(prop));
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const prop of normalized) {
    const key = `${prop.property_name}::${prop.property_type}`;
    if (seen.has(key)) {
      duplicates.add(`${prop.property_name} (${prop.property_type})`);
    }
    seen.add(key);
  }

  if (duplicates.size > 0) {
    throw new DuplicatePropertyError(
      `Duplicate properties in payload: ${Array.from(duplicates).sort().join(', ')}`,
    );
  }

  normalized.sort((a, b) => {
    if (a.property_type === b.property_type) {
      return a.property_name.localeCompare(b.property_name);
    }
    return a.property_type.localeCompare(b.property_type);
  });

  return normalized;
}

export function buildSnapshot(input: {
  name: string;
  description?: string | null;
  category?: string | null;
  properties: Array<NormalizedProperty | Record<string, unknown>>;
  isArchived: boolean;
}): EventSnapshot {
  return {
    event: {
      name: input.name.trim(),
      description: normalizeOptionalText(input.description),
      category: normalizeOptionalText(input.category),
      is_archived: input.isArchived,
    },
    properties: normalizeProperties(input.properties),
  };
}

export function checksumSnapshot(snapshot: EventSnapshot): string {
  return createHash('sha256').update(stableStringify(snapshot), 'utf8').digest('hex');
}

export function buildDiff(previousSnapshot: EventSnapshot | null, nextSnapshot: EventSnapshot): EventDiff {
  const metadata: Record<string, { from: unknown; to: unknown }> = {};

  const previousEvent = previousSnapshot?.event;
  for (const key of ['name', 'description', 'category', 'is_archived'] as const) {
    const prev = previousEvent?.[key];
    const next = nextSnapshot.event[key];
    if (!previousSnapshot || prev !== next) {
      metadata[key] = { from: prev ?? null, to: next };
    }
  }

  const previousProperties = new Map<string, NormalizedProperty>();
  for (const prop of previousSnapshot?.properties ?? []) {
    previousProperties.set(`${prop.property_name}:${prop.property_type}`, prop);
  }

  const nextProperties = new Map<string, NormalizedProperty>();
  for (const prop of nextSnapshot.properties) {
    nextProperties.set(`${prop.property_name}:${prop.property_type}`, prop);
  }

  const added = Array.from(nextProperties.keys())
    .filter((key) => !previousProperties.has(key))
    .sort()
    .map((key) => nextProperties.get(key) as NormalizedProperty);

  const removed = Array.from(previousProperties.keys())
    .filter((key) => !nextProperties.has(key))
    .sort()
    .map((key) => previousProperties.get(key) as NormalizedProperty);

  const updated = Array.from(previousProperties.keys())
    .filter((key) => nextProperties.has(key))
    .sort()
    .map((key) => ({ key, before: previousProperties.get(key)!, after: nextProperties.get(key)! }))
    .filter(({ before, after }) => stableStringify(before) !== stableStringify(after));

  return {
    metadata,
    properties: {
      added,
      removed,
      updated,
    },
  };
}

export function buildSummary(
  action: VersionAction,
  diff: EventDiff,
  options: {
    targetVersionNumber?: number;
    propertyCount?: number;
  } = {},
): string {
  if (action === 'create') {
    const count = options.propertyCount ?? 0;
    return `Created event with ${count} ${count === 1 ? 'property' : 'properties'}`;
  }
  if (action === 'archive') {
    return 'Archived event';
  }
  if (action === 'restore') {
    return 'Restored event';
  }
  if (action === 'revert') {
    return `Reverted to version ${options.targetVersionNumber}`;
  }

  const metadataChanges = Object.keys(diff.metadata).length;
  const added = diff.properties.added.length;
  const removed = diff.properties.removed.length;
  const updated = diff.properties.updated.length;

  const parts: string[] = [];
  if (metadataChanges > 0) {
    parts.push(`${metadataChanges} metadata ${metadataChanges === 1 ? 'field' : 'fields'}`);
  }
  if (added > 0) {
    parts.push(`added ${added} ${added === 1 ? 'property' : 'properties'}`);
  }
  if (removed > 0) {
    parts.push(`removed ${removed} ${removed === 1 ? 'property' : 'properties'}`);
  }
  if (updated > 0) {
    parts.push(`updated ${updated} ${updated === 1 ? 'property' : 'properties'}`);
  }

  if (parts.length === 0) {
    return 'No changes';
  }

  return `Updated ${parts.join(', ')}`;
}

function getCurrentVersion(db: Database, event: EventRow): EventVersionRow | null {
  if (!event.current_version_id) {
    return null;
  }

  const version = db
    .query('SELECT * FROM event_versions WHERE id = ? AND event_id = ?')
    .get(event.current_version_id, event.id) as EventVersionRow | null;

  return version;
}

export function ensureBaseVersion(event: EventRow, baseVersionNumber: number): void {
  if (baseVersionNumber !== event.current_version_number) {
    throw new VersionConflictError(event.current_version_number);
  }
}

function upsertRegistryProperties(
  db: Database,
  properties: NormalizedProperty[],
  actor: string | null,
): Map<string, PropertyRow> {
  const registry = new Map<string, PropertyRow>();

  for (const prop of properties) {
    const existing = db.query('SELECT * FROM properties WHERE name = ?').get(prop.property_name) as
      | PropertyRow
      | null;

    if (existing) {
      if (existing.data_type !== prop.data_type) {
        throw new RegistryConflictError(
          `Property '${prop.property_name}' already exists with data type '${existing.data_type}'. Cannot redefine as '${prop.data_type}'.`,
        );
      }

      if (!existing.description && prop.description) {
        db.query('UPDATE properties SET description = ? WHERE id = ?').run(prop.description, existing.id);
        existing.description = prop.description;
      }

      registry.set(prop.property_name, existing);
      continue;
    }

    const createdAt = nowIso();
    const insert = db
      .query(
        'INSERT INTO properties (name, data_type, description, created_at, created_by) VALUES (?, ?, ?, ?, ?)',
      )
      .run(prop.property_name, prop.data_type, prop.description, createdAt, actor);

    registry.set(prop.property_name, {
      id: Number(insert.lastInsertRowid),
      name: prop.property_name,
      data_type: prop.data_type,
      description: prop.description,
      created_at: createdAt,
      created_by: actor,
    });
  }

  return registry;
}

function replaceEventProjection(
  db: Database,
  event: EventRow,
  snapshot: EventSnapshot,
  registry: Map<string, PropertyRow>,
): void {
  db.query('UPDATE events SET name = ?, description = ?, category = ? WHERE id = ?').run(
    snapshot.event.name,
    snapshot.event.description,
    snapshot.event.category,
    event.id,
  );

  db.query('DELETE FROM event_properties WHERE event_id = ?').run(event.id);

  const insertProperty = db.query(
    `INSERT INTO event_properties (
      event_id,
      property_id,
      property_name,
      property_type,
      data_type,
      description,
      is_required,
      example_value
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const prop of snapshot.properties) {
    const registryProperty = registry.get(prop.property_name);
    if (!registryProperty) {
      continue;
    }

    insertProperty.run(
      event.id,
      registryProperty.id,
      prop.property_name,
      prop.property_type,
      prop.data_type,
      prop.description,
      prop.is_required ? 1 : 0,
      prop.example_value,
    );
  }
}

function writeVersion(
  db: Database,
  input: {
    event: EventRow;
    action: VersionAction;
    snapshot: EventSnapshot;
    diff: EventDiff;
    actor: string | null;
    changeReason: string | null;
    targetVersionNumber?: number;
    revertedFromVersionId?: number | null;
  },
): EventVersionRow {
  const parentVersion = getCurrentVersion(db, input.event);
  const createdAt = nowIso();
  const versionNumber = input.event.current_version_number + 1;

  const insertVersion = db
    .query(
      `INSERT INTO event_versions (
        event_id,
        version_number,
        parent_version_id,
        action,
        summary,
        change_reason,
        snapshot,
        diff,
        checksum,
        created_by,
        created_at,
        reverted_from_version_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.event.id,
      versionNumber,
      parentVersion?.id ?? null,
      input.action,
      buildSummary(input.action, input.diff, {
        targetVersionNumber: input.targetVersionNumber,
        propertyCount: input.snapshot.properties.length,
      }),
      normalizeOptionalText(input.changeReason),
      JSON.stringify(input.snapshot),
      JSON.stringify(input.diff),
      checksumSnapshot(input.snapshot),
      input.actor,
      createdAt,
      input.revertedFromVersionId ?? null,
    );

  const versionId = Number(insertVersion.lastInsertRowid);

  const isArchived = input.snapshot.event.is_archived;
  const updatedAt = nowIso();

  db.query(
    `UPDATE events
      SET updated_at = ?,
          current_version_number = ?,
          current_version_id = ?,
          is_archived = ?,
          archived_at = ?,
          archived_by = ?,
          lock_version = lock_version + 1
      WHERE id = ?`,
  ).run(
    updatedAt,
    versionNumber,
    versionId,
    isArchived ? 1 : 0,
    isArchived ? updatedAt : null,
    isArchived ? input.actor : null,
    input.event.id,
  );

  return db.query('SELECT * FROM event_versions WHERE id = ?').get(versionId) as EventVersionRow;
}

export function createEventVersioned(db: Database, payload: EventCreatePayload): EventRow {
  const snapshotProperties = payload.properties.map((prop) => ({
    ...prop,
    example_value: prop.example_value ?? null,
    description: prop.description ?? null,
  }));

  const snapshot = buildSnapshot({
    name: payload.name,
    description: payload.description,
    category: payload.category,
    properties: snapshotProperties,
    isArchived: false,
  });

  const registry = upsertRegistryProperties(db, snapshot.properties, payload.created_by ?? null);

  const now = nowIso();
  const created = db
    .query(
      `INSERT INTO events (
        name,
        description,
        category,
        created_at,
        updated_at,
        created_by,
        current_version_number,
        current_version_id,
        is_archived,
        archived_at,
        archived_by,
        lock_version
      ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, 0, NULL, NULL, 0)`,
    )
    .run(snapshot.event.name, snapshot.event.description, snapshot.event.category, now, now, payload.created_by ?? null);

  const eventId = Number(created.lastInsertRowid);
  const event = db.query('SELECT * FROM events WHERE id = ?').get(eventId) as EventRow;

  replaceEventProjection(db, event, snapshot, registry);
  writeVersion(db, {
    event,
    action: 'create',
    snapshot,
    diff: buildDiff(null, snapshot),
    actor: payload.created_by ?? null,
    changeReason: payload.change_reason ?? null,
  });

  return db.query('SELECT * FROM events WHERE id = ?').get(eventId) as EventRow;
}

export function updateEventVersioned(
  db: Database,
  event: EventRow,
  payload: EventUpdatePayload,
): { changed: boolean } {
  if (Boolean(event.is_archived)) {
    throw new InvalidEventStateError('Archived events must be restored before they can be edited.');
  }

  ensureBaseVersion(event, payload.base_version_number);
  const currentVersion = getCurrentVersion(db, event);
  if (!currentVersion) {
    throw new InvalidEventStateError('Event has no current version.');
  }

  const snapshotProperties = payload.properties.map((prop) => ({
    ...prop,
    example_value: prop.example_value ?? null,
    description: prop.description ?? null,
  }));

  const snapshot = buildSnapshot({
    name: payload.name,
    description: payload.description,
    category: payload.category,
    properties: snapshotProperties,
    isArchived: false,
  });

  const checksum = checksumSnapshot(snapshot);
  if (checksum === currentVersion.checksum) {
    return { changed: false };
  }

  const registry = upsertRegistryProperties(db, snapshot.properties, payload.changed_by ?? null);
  replaceEventProjection(db, event, snapshot, registry);
  writeVersion(db, {
    event,
    action: 'update',
    snapshot,
    diff: buildDiff(parseJson<EventSnapshot>(currentVersion.snapshot), snapshot),
    actor: payload.changed_by ?? null,
    changeReason: payload.change_reason ?? null,
  });

  return { changed: true };
}

export function archiveEventVersioned(
  db: Database,
  event: EventRow,
  input: {
    baseVersionNumber: number;
    changedBy: string | null;
    changeReason: string | null;
  },
): { changed: boolean } {
  if (Boolean(event.is_archived)) {
    throw new InvalidEventStateError('Event is already archived.');
  }

  ensureBaseVersion(event, input.baseVersionNumber);
  const currentVersion = getCurrentVersion(db, event);
  if (!currentVersion) {
    throw new InvalidEventStateError('Event has no current version.');
  }

  const currentSnapshot = parseJson<EventSnapshot>(currentVersion.snapshot);
  const snapshot = buildSnapshot({
    name: currentSnapshot.event.name,
    description: currentSnapshot.event.description,
    category: currentSnapshot.event.category,
    properties: currentSnapshot.properties,
    isArchived: true,
  });

  const registry = upsertRegistryProperties(db, snapshot.properties, input.changedBy);
  replaceEventProjection(db, event, snapshot, registry);
  writeVersion(db, {
    event,
    action: 'archive',
    snapshot,
    diff: buildDiff(currentSnapshot, snapshot),
    actor: input.changedBy,
    changeReason: input.changeReason,
  });

  return { changed: true };
}

export function restoreEventVersioned(
  db: Database,
  event: EventRow,
  input: {
    baseVersionNumber: number;
    changedBy: string | null;
    changeReason: string | null;
  },
): { changed: boolean } {
  if (!Boolean(event.is_archived)) {
    throw new InvalidEventStateError('Event is already active.');
  }

  ensureBaseVersion(event, input.baseVersionNumber);
  const currentVersion = getCurrentVersion(db, event);
  if (!currentVersion) {
    throw new InvalidEventStateError('Event has no current version.');
  }

  const currentSnapshot = parseJson<EventSnapshot>(currentVersion.snapshot);
  const snapshot = buildSnapshot({
    name: currentSnapshot.event.name,
    description: currentSnapshot.event.description,
    category: currentSnapshot.event.category,
    properties: currentSnapshot.properties,
    isArchived: false,
  });

  const registry = upsertRegistryProperties(db, snapshot.properties, input.changedBy);
  replaceEventProjection(db, event, snapshot, registry);
  writeVersion(db, {
    event,
    action: 'restore',
    snapshot,
    diff: buildDiff(currentSnapshot, snapshot),
    actor: input.changedBy,
    changeReason: input.changeReason,
  });

  return { changed: true };
}

export function revertEventVersioned(
  db: Database,
  event: EventRow,
  input: {
    targetVersion: EventVersionRow;
    baseVersionNumber: number;
    changedBy: string | null;
    changeReason: string | null;
  },
): { changed: boolean } {
  ensureBaseVersion(event, input.baseVersionNumber);

  const currentVersion = getCurrentVersion(db, event);
  if (!currentVersion) {
    throw new InvalidEventStateError('Event has no current version.');
  }

  if (currentVersion.checksum === input.targetVersion.checksum) {
    return { changed: false };
  }

  const snapshot = parseJson<EventSnapshot>(input.targetVersion.snapshot);
  const currentSnapshot = parseJson<EventSnapshot>(currentVersion.snapshot);
  const registry = upsertRegistryProperties(db, snapshot.properties, input.changedBy);

  replaceEventProjection(db, event, snapshot, registry);
  writeVersion(db, {
    event,
    action: 'revert',
    snapshot,
    diff: buildDiff(currentSnapshot, snapshot),
    actor: input.changedBy,
    changeReason: input.changeReason,
    targetVersionNumber: input.targetVersion.version_number,
    revertedFromVersionId: input.targetVersion.id,
  });

  return { changed: true };
}

export function serializeEvent(event: EventRow, properties: EventPropertyRow[]): Record<string, unknown> {
  return {
    id: event.id,
    name: event.name,
    description: event.description,
    category: event.category,
    created_by: event.created_by,
    created_at: event.created_at,
    updated_at: event.updated_at,
    version_number: event.current_version_number,
    is_archived: Boolean(event.is_archived),
    archived_at: event.archived_at,
    archived_by: event.archived_by,
    lock_version: event.lock_version,
    properties: properties.map((prop) => ({
      id: prop.id,
      property_id: prop.property_id,
      property_name: prop.property_name,
      property_type: prop.property_type,
      data_type: prop.data_type,
      description: prop.description,
      is_required: Boolean(prop.is_required),
      example_value: prop.example_value,
    })),
  };
}

export function buildVersionNumberLookup(versions: EventVersionRow[]): Map<number, number> {
  const lookup = new Map<number, number>();
  for (const version of versions) {
    lookup.set(version.id, version.version_number);
  }
  return lookup;
}

export function serializeVersionSummary(
  event: EventRow,
  version: EventVersionRow,
  versionLookup: Map<number, number>,
): Record<string, unknown> {
  const snapshot = parseJson<EventSnapshot>(version.snapshot);
  return {
    id: version.id,
    event_id: event.id,
    event_name: snapshot.event.name,
    version_number: version.version_number,
    action: version.action,
    summary: version.summary,
    change_reason: version.change_reason,
    created_by: version.created_by,
    created_at: version.created_at,
    parent_version_number: version.parent_version_id
      ? (versionLookup.get(version.parent_version_id) ?? null)
      : null,
    reverted_from_version_number: version.reverted_from_version_id
      ? (versionLookup.get(version.reverted_from_version_id) ?? null)
      : null,
    is_current: event.current_version_id === version.id,
  };
}

export function serializeVersionDetail(
  event: EventRow,
  version: EventVersionRow,
  versionLookup: Map<number, number>,
): Record<string, unknown> {
  const summary = serializeVersionSummary(event, version, versionLookup);
  return {
    ...summary,
    checksum: version.checksum,
    snapshot: parseJson<EventSnapshot>(version.snapshot),
    diff: parseJson<EventDiff>(version.diff),
  };
}

export function serializeChangelogEntry(event: EventRow, version: EventVersionRow): Record<string, unknown> {
  return {
    id: version.id,
    entity_type: 'event',
    entity_id: event.id,
    event_name: parseJson<EventSnapshot>(version.snapshot).event.name,
    version_number: version.version_number,
    action: version.action,
    summary: version.summary,
    change_reason: version.change_reason,
    diff: parseJson<EventDiff>(version.diff),
    snapshot: parseJson<EventSnapshot>(version.snapshot),
    changed_by: version.created_by,
    changed_at: version.created_at,
    is_current: event.current_version_id === version.id,
  };
}
