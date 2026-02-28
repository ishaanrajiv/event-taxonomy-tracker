import { Database } from 'bun:sqlite';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  archiveEventVersioned,
  buildVersionNumberLookup,
  createEventVersioned,
  restoreEventVersioned,
  revertEventVersioned,
  serializeChangelogEntry,
  serializeEvent,
  serializeVersionDetail,
  serializeVersionSummary,
  updateEventVersioned,
} from './domain/versioning';
import { createDatabase, runInTransaction } from './db';
import { HttpError, InvalidEventStateError, RegistryConflictError, VersionConflictError, DuplicatePropertyError } from './errors';
import { parseCsv } from './utils/csv';
import { findSimilarProperties } from './utils/fuzzy';
import {
  parseEventArchivePayload,
  parseEventCreatePayload,
  parseEventRevertPayload,
  parseEventUpdatePayload,
  parsePropertyCreatePayload,
} from './validation';
import type { EventPropertyRow, EventRow, EventVersionRow, PropertyRow } from './types';

interface CreateAppOptions {
  db?: Database;
  dbPath?: string;
}

export function createApp(options: CreateAppOptions = {}): {
  app: Hono;
  db: Database;
  close: () => void;
} {
  const dbContext = options.db
    ? { db: options.db, dbPath: ':provided:' }
    : createDatabase(options.dbPath);
  const { db } = dbContext;

  const app = new Hono();

  app.use(
    '*',
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
      credentials: true,
      exposeHeaders: ['X-Total-Count'],
    }),
  );

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ detail: error.detail }, { status: error.status as 400 });
    }

    if (
      error instanceof DuplicatePropertyError ||
      error instanceof RegistryConflictError
    ) {
      return c.json({ detail: error.message }, 400);
    }

    if (error instanceof VersionConflictError || error instanceof InvalidEventStateError) {
      return c.json({ detail: error.message }, 409);
    }

    if (isSqliteConstraintError(error)) {
      return c.json({ detail: 'Event update failed due to a conflicting database constraint' }, 409);
    }

    console.error(error);
    return c.json({ detail: 'Internal Server Error' }, 500);
  });

  app.get('/api/events', (c) => {
    const query = c.req.query();
    const q = query.q?.trim();
    const category = query.category?.trim();
    const createdBy = query.created_by?.trim();
    const dateFrom = query.date_from?.trim();
    const dateTo = query.date_to?.trim();

    const includeArchived = query.include_archived === 'true';
    const onlyArchived = query.only_archived === 'true';

    const sortOrder = query.sort_order === 'desc' ? 'desc' : 'asc';
    const skip = parseIntegerOrDefault(query.skip, 0, 0, Number.MAX_SAFE_INTEGER, 'skip');
    const limit = parseIntegerOrDefault(query.limit, 100, 1, 500, 'limit');

    const where: string[] = [];
    const params: Array<string | number> = [];

    if (onlyArchived) {
      where.push('is_archived = 1');
    } else if (!includeArchived) {
      where.push('is_archived = 0');
    }

    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    if (createdBy) {
      where.push('created_by LIKE ?');
      params.push(`%${createdBy}%`);
    }

    if (dateFrom) {
      params.push(parseIsoDate(dateFrom, 'date_from'));
      where.push('created_at >= ?');
    }

    if (dateTo) {
      params.push(parseIsoDate(dateTo, 'date_to'));
      where.push('created_at <= ?');
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const totalCountRow = db
      .query(`SELECT COUNT(*) as total FROM events ${whereSql}`)
      .get(...params) as { total: number };
    let totalCount = totalCountRow?.total ?? 0;

    const orderSql = sortOrder === 'desc' ? 'DESC' : 'ASC';

    let eventsRows: EventRow[];
    if (q) {
      eventsRows = db
        .query(`SELECT * FROM events ${whereSql} ORDER BY created_at ${orderSql}`)
        .all(...params) as EventRow[];

      const scored: Array<{ score: number; event: Record<string, unknown> }> = [];
      for (const event of eventsRows) {
        const serialized = serializeEvent(event, getEventProperties(db, event.id));
        const score = scoreEvent(serialized, q.toLowerCase());
        if (score > 0) {
          scored.push({ score, event: serialized });
        }
      }

      scored.sort((a, b) => {
        const first = String(a.event.created_at ?? '');
        const second = String(b.event.created_at ?? '');
        if (first === second) return 0;
        return sortOrder === 'desc' ? second.localeCompare(first) : first.localeCompare(second);
      });
      scored.sort((a, b) => b.score - a.score);

      const ranked = scored.map((item) => item.event);
      totalCount = ranked.length;
      c.header('X-Total-Count', String(totalCount));
      return c.json(ranked.slice(skip, skip + limit));
    }

    eventsRows = db
      .query(`SELECT * FROM events ${whereSql} ORDER BY created_at ${orderSql} LIMIT ? OFFSET ?`)
      .all(...params, limit, skip) as EventRow[];

    const serialized = eventsRows.map((event) => serializeEvent(event, getEventProperties(db, event.id)));
    c.header('X-Total-Count', String(totalCount));
    return c.json(serialized);
  });

  app.post('/api/events', async (c) => {
    const body = await parseJsonBody(c.req.raw);
    const payload = parseEventCreatePayload(body);

    const createdEvent = runInTransaction(db, () => createEventVersioned(db, payload));
    return c.json(serializeEvent(createdEvent, getEventProperties(db, createdEvent.id)));
  });

  app.get('/api/events/:eventId', (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const event = loadEvent(db, eventId);
    return c.json(serializeEvent(event, getEventProperties(db, event.id)));
  });

  app.put('/api/events/:eventId', async (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const body = await parseJsonBody(c.req.raw);
    const payload = parseEventUpdatePayload(body);

    runInTransaction(db, () => {
      const event = loadEvent(db, eventId);
      updateEventVersioned(db, event, payload);
    });

    const updated = loadEvent(db, eventId);
    return c.json(serializeEvent(updated, getEventProperties(db, updated.id)));
  });

  app.post('/api/events/:eventId/archive', async (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const body = await parseJsonBody(c.req.raw);
    const payload = parseEventArchivePayload(body);

    runInTransaction(db, () => {
      const event = loadEvent(db, eventId);
      archiveEventVersioned(db, event, {
        baseVersionNumber: payload.base_version_number,
        changedBy: payload.changed_by ?? null,
        changeReason: payload.change_reason ?? null,
      });
    });

    const archived = loadEvent(db, eventId);
    return c.json(serializeEvent(archived, getEventProperties(db, archived.id)));
  });

  app.post('/api/events/:eventId/restore', async (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const body = await parseJsonBody(c.req.raw);
    const payload = parseEventArchivePayload(body);

    runInTransaction(db, () => {
      const event = loadEvent(db, eventId);
      restoreEventVersioned(db, event, {
        baseVersionNumber: payload.base_version_number,
        changedBy: payload.changed_by ?? null,
        changeReason: payload.change_reason ?? null,
      });
    });

    const restored = loadEvent(db, eventId);
    return c.json(serializeEvent(restored, getEventProperties(db, restored.id)));
  });

  app.get('/api/events/:eventId/versions', (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const event = loadEvent(db, eventId);
    const versions = db
      .query('SELECT * FROM event_versions WHERE event_id = ? ORDER BY version_number DESC')
      .all(eventId) as EventVersionRow[];

    const lookup = buildVersionNumberLookup(versions);
    return c.json(versions.map((version) => serializeVersionSummary(event, version, lookup)));
  });

  app.get('/api/events/:eventId/versions/:versionNumber', (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const versionNumber = parsePathInt(c.req.param('versionNumber'), 'version_number');

    const event = loadEvent(db, eventId);
    const versions = db
      .query('SELECT * FROM event_versions WHERE event_id = ? ORDER BY version_number DESC')
      .all(eventId) as EventVersionRow[];

    const target = versions.find((version) => version.version_number === versionNumber);
    if (!target) {
      throw new HttpError(404, 'Event version not found');
    }

    const lookup = buildVersionNumberLookup(versions);
    return c.json(serializeVersionDetail(event, target, lookup));
  });

  app.post('/api/events/:eventId/versions/:versionNumber/revert', async (c) => {
    const eventId = parsePathInt(c.req.param('eventId'), 'event_id');
    const versionNumber = parsePathInt(c.req.param('versionNumber'), 'version_number');
    const body = await parseJsonBody(c.req.raw);
    const payload = parseEventRevertPayload(body);

    runInTransaction(db, () => {
      const event = loadEvent(db, eventId);
      const target = db
        .query('SELECT * FROM event_versions WHERE event_id = ? AND version_number = ?')
        .get(eventId, versionNumber) as EventVersionRow | null;
      if (!target) {
        throw new HttpError(404, 'Event version not found');
      }

      revertEventVersioned(db, event, {
        targetVersion: target,
        baseVersionNumber: payload.base_version_number,
        changedBy: payload.changed_by ?? null,
        changeReason: payload.change_reason ?? null,
      });
    });

    const event = loadEvent(db, eventId);
    return c.json(serializeEvent(event, getEventProperties(db, event.id)));
  });

  app.get('/api/properties', (c) => {
    const properties = db.query('SELECT * FROM properties ORDER BY name ASC').all() as PropertyRow[];
    return c.json(properties);
  });

  app.post('/api/properties', async (c) => {
    const body = await parseJsonBody(c.req.raw);
    const payload = parsePropertyCreatePayload(body);

    const existing = db.query('SELECT * FROM properties WHERE name = ?').get(payload.name) as PropertyRow | null;
    if (existing) {
      throw new HttpError(
        400,
        `Property '${payload.name}' already exists with data type '${existing.data_type}'`,
      );
    }

    const now = new Date().toISOString();
    const inserted = db
      .query(
        'INSERT INTO properties (name, data_type, description, created_at, created_by) VALUES (?, ?, ?, ?, ?)',
      )
      .run(payload.name, payload.data_type, payload.description, now, payload.created_by);

    const row = db
      .query('SELECT * FROM properties WHERE id = ?')
      .get(Number(inserted.lastInsertRowid)) as PropertyRow;

    return c.json(row);
  });

  app.get('/api/properties/suggest', (c) => {
    const q = c.req.query('q') ?? '';
    const all = db.query('SELECT name, data_type FROM properties').all() as Array<{
      name: string;
      data_type: string;
    }>;

    const suggestions = findSimilarProperties(
      q,
      all.map((prop) => [prop.name, prop.data_type]),
      0.6,
    );

    return c.json({ query: q, suggestions });
  });

  app.get('/api/changelog', (c) => {
    const entityType = c.req.query('entity_type');
    const entityIdRaw = c.req.query('entity_id');
    const limit = parseIntegerOrDefault(c.req.query('limit'), 50, 1, 500, 'limit');

    if (entityType && entityType !== 'event') {
      return c.json([]);
    }

    const params: Array<string | number> = [];
    let where = '';
    if (entityIdRaw != null) {
      const entityId = parsePathInt(entityIdRaw, 'entity_id');
      where = 'WHERE v.event_id = ?';
      params.push(entityId);
    }

    const rows = db
      .query(
        `SELECT
           v.id as version_id,
           v.event_id as version_event_id,
           v.version_number,
           v.parent_version_id,
           v.action,
           v.summary,
           v.change_reason,
           v.snapshot,
           v.diff,
           v.checksum,
           v.created_by as version_created_by,
           v.created_at as version_created_at,
           v.reverted_from_version_id,
           e.id as event_id,
           e.name as event_name,
           e.description as event_description,
           e.category as event_category,
           e.created_at as event_created_at,
           e.updated_at as event_updated_at,
           e.created_by as event_created_by,
           e.current_version_number,
           e.current_version_id,
           e.is_archived,
           e.archived_at,
           e.archived_by,
           e.lock_version
         FROM event_versions v
         INNER JOIN events e ON e.id = v.event_id
         ${where}
         ORDER BY v.created_at DESC, v.id DESC
         LIMIT ?`,
      )
      .all(...params, limit) as Array<{
      version_id: number;
      version_event_id: number;
      version_number: number;
      parent_version_id: number | null;
      action: EventVersionRow['action'];
      summary: string;
      change_reason: string | null;
      snapshot: string;
      diff: string;
      checksum: string;
      version_created_by: string | null;
      version_created_at: string;
      reverted_from_version_id: number | null;
      event_id: number;
      event_name: string;
      event_description: string | null;
      event_category: string | null;
      event_created_at: string;
      event_updated_at: string;
      event_created_by: string | null;
      current_version_number: number;
      current_version_id: number | null;
      is_archived: number;
      archived_at: string | null;
      archived_by: string | null;
      lock_version: number;
    }>;

    const changelog = rows.map((row) => {
      const event: EventRow = {
        id: row.event_id,
        name: row.event_name,
        description: row.event_description,
        category: row.event_category,
        created_at: row.event_created_at,
        updated_at: row.event_updated_at,
        created_by: row.event_created_by,
        current_version_number: row.current_version_number,
        current_version_id: row.current_version_id,
        is_archived: row.is_archived,
        archived_at: row.archived_at,
        archived_by: row.archived_by,
        lock_version: row.lock_version,
      };

      const version: EventVersionRow = {
        id: row.version_id,
        event_id: row.version_event_id,
        version_number: row.version_number,
        parent_version_id: row.parent_version_id,
        action: row.action,
        summary: row.summary,
        change_reason: row.change_reason,
        snapshot: row.snapshot,
        diff: row.diff,
        checksum: row.checksum,
        created_by: row.version_created_by,
        created_at: row.version_created_at,
        reverted_from_version_id: row.reverted_from_version_id,
      };

      return serializeChangelogEntry(event, version);
    });

    return c.json(changelog);
  });

  app.get('/api/search', (c) => {
    const q = c.req.query('q') ?? '';
    const escaped = `"${q.replace(/"/g, '""')}"`;

    let events: Array<{ id: number; name: string; type: 'event' }> = [];

    try {
      const rows = db
        .query(
          `SELECT DISTINCT e.id as id, e.name as name
           FROM events e
           INNER JOIN events_fts fts ON e.id = fts.rowid
           WHERE events_fts MATCH ?
             AND e.is_archived = 0
           ORDER BY bm25(events_fts)
           LIMIT 50`,
        )
        .all(escaped) as Array<{ id: number; name: string }>;

      events = rows.map((row) => ({ id: row.id, name: row.name, type: 'event' }));
    } catch {
      events = [];
    }

    const properties = db
      .query(
        `SELECT id, name
         FROM properties
         WHERE name LIKE ? OR COALESCE(description, '') LIKE ?`,
      )
      .all(`%${q}%`, `%${q}%`) as Array<{ id: number; name: string }>;

    return c.json({
      query: q,
      events,
      properties: properties.map((prop) => ({ id: prop.id, name: prop.name, type: 'property' })),
    });
  });

  app.get('/api/features', (c) => {
    const rows = db
      .query(
        `SELECT category, updated_at
         FROM events
         WHERE category IS NOT NULL
           AND is_archived = 0
         ORDER BY updated_at DESC`,
      )
      .all() as Array<{ category: string; updated_at: string }>;

    const seen = new Map<string, string>();
    for (const row of rows) {
      if (!seen.has(row.category)) {
        seen.set(row.category, row.updated_at);
      }
    }

    const sortedByRecent = Array.from(seen.entries()).sort((a, b) => b[1].localeCompare(a[1]));
    const recent = sortedByRecent.slice(0, 3).map(([category]) => category);
    const remaining = Array.from(seen.keys())
      .filter((category) => !recent.includes(category))
      .sort((a, b) => a.localeCompare(b));

    return c.json({
      recent,
      all: [...recent, ...remaining],
      default: 'Engagement',
    });
  });

  app.get('/api/filter-options', (c) => {
    const categories = db
      .query(
        `SELECT DISTINCT category
         FROM events
         WHERE is_archived = 0 AND category IS NOT NULL
         ORDER BY category ASC`,
      )
      .all() as Array<{ category: string | null }>;

    const creators = db
      .query(
        `SELECT DISTINCT created_by
         FROM events
         WHERE is_archived = 0 AND created_by IS NOT NULL
         ORDER BY created_by ASC`,
      )
      .all() as Array<{ created_by: string | null }>;

    const dateRange = db
      .query(
        `SELECT MIN(created_at) as min_date, MAX(created_at) as max_date
         FROM events
         WHERE is_archived = 0`,
      )
      .get() as { min_date: string | null; max_date: string | null };

    return c.json({
      categories: categories.map((item) => item.category).filter(Boolean),
      creators: creators.map((item) => item.created_by).filter(Boolean),
      date_range: {
        min: dateRange.min_date,
        max: dateRange.max_date,
      },
    });
  });

  app.get('/', (c) => c.json({ message: 'Event Taxonomy Tracker API', version: '2.0.0' }));

  app.get('/api/export/template/json', () => {
    const template = [
      {
        name: 'Example Event',
        description: 'Description of what triggers this event',
        category: 'Engagement',
        properties: [
          {
            property_name: 'example_property',
            property_type: 'event',
            data_type: 'String',
            is_required: true,
            example_value: 'example_value',
            description: 'What this property represents',
          },
        ],
      },
    ];

    const body = JSON.stringify(template, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'Content-Disposition': 'attachment; filename=event_template.json',
      },
    });
  });

  app.get('/api/export/template/csv', () => {
    const rows = [
      [
        'event_name',
        'event_description',
        'event_category',
        'property_name',
        'property_type',
        'data_type',
        'is_required',
        'example_value',
        'property_description',
      ],
      [
        'Example Event',
        'Description of event',
        'Engagement',
        'user_id',
        'user',
        'String',
        'true',
        'user_123',
        'Unique user identifier',
      ],
      [
        'Example Event',
        '',
        '',
        'action_name',
        'event',
        'String',
        'true',
        'click',
        'Name of the action',
      ],
    ];

    const body = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=event_template.csv',
      },
    });
  });

  app.post('/api/import/json', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'Missing file upload');
    }

    const text = await file.text();
    let eventsData: unknown;

    try {
      eventsData = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'Invalid JSON file');
    }

    if (!Array.isArray(eventsData)) {
      throw new HttpError(400, 'JSON must be an array of events');
    }

    let importedCount = 0;
    const errors: string[] = [];

    eventsData.forEach((eventData, index) => {
      try {
        const payload = parseEventCreatePayload(eventData);
        runInTransaction(db, () => {
          createEventVersioned(db, payload);
        });
        importedCount += 1;
      } catch (error) {
        if (
          error instanceof DuplicatePropertyError ||
          error instanceof RegistryConflictError ||
          error instanceof InvalidEventStateError ||
          error instanceof VersionConflictError
        ) {
          errors.push(`Row ${index + 1}: ${error.message}`);
          return;
        }

        if (error instanceof HttpError) {
          errors.push(`Row ${index + 1}: ${error.detail}`);
          return;
        }

        if (isSqliteConstraintError(error)) {
          errors.push(`Row ${index + 1}: Integrity constraint conflict`);
          return;
        }

        errors.push(`Row ${index + 1}: ${(error as Error).message}`);
      }
    });

    return c.json({ imported: importedCount, total: eventsData.length, errors });
  });

  app.post('/api/import/csv', async (c) => {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'Missing file upload');
    }

    const content = await file.text();

    const errors: string[] = [];
    const eventsMap = new Map<string, {
      name: string;
      description: string | null;
      category: string | null;
      created_by: string;
      properties: Array<{
        property_name: string;
        property_type: string;
        data_type: string;
        is_required: boolean;
        example_value: string | null;
        description: string | null;
      }>;
    }>();

    try {
      const rows = parseCsv(content);
      rows.forEach((row, index) => {
        try {
          const eventName = (row.event_name ?? '').trim();
          if (!eventName) {
            return;
          }

          if (!eventsMap.has(eventName)) {
            eventsMap.set(eventName, {
              name: eventName,
              description: toNullable(row.event_description),
              category: toNullable(row.event_category),
              created_by: 'bulk_import',
              properties: [],
            });
          }

          const propertyName = (row.property_name ?? '').trim();
          if (!propertyName) {
            return;
          }

          const event = eventsMap.get(eventName)!;
          event.properties.push({
            property_name: propertyName,
            property_type: (row.property_type ?? 'event').trim() || 'event',
            data_type: (row.data_type ?? 'String').trim() || 'String',
            is_required: ['true', '1', 'yes'].includes((row.is_required ?? '').toLowerCase()),
            example_value: toNullable(row.example_value),
            description: toNullable(row.property_description),
          });
        } catch (error) {
          errors.push(`Row ${index + 2}: ${(error as Error).message}`);
        }
      });
    } catch (error) {
      throw new HttpError(400, (error as Error).message);
    }

    let importedCount = 0;
    for (const eventData of eventsMap.values()) {
      try {
        const payload = parseEventCreatePayload(eventData);
        runInTransaction(db, () => {
          createEventVersioned(db, payload);
        });
        importedCount += 1;
      } catch (error) {
        if (
          error instanceof DuplicatePropertyError ||
          error instanceof RegistryConflictError ||
          error instanceof InvalidEventStateError ||
          error instanceof VersionConflictError
        ) {
          errors.push(`Event '${eventData.name}': ${error.message}`);
          continue;
        }

        if (error instanceof HttpError) {
          errors.push(`Event '${eventData.name}': ${error.detail}`);
          continue;
        }

        if (isSqliteConstraintError(error)) {
          errors.push(`Event '${eventData.name}': Integrity constraint conflict`);
          continue;
        }

        errors.push(`Event '${eventData.name}': ${(error as Error).message}`);
      }
    }

    return c.json({ imported: importedCount, total: eventsMap.size, errors });
  });

  return {
    app,
    db,
    close: () => {
      if (!options.db) {
        db.close();
      }
    },
  };
}

function isSqliteConstraintError(error: unknown): boolean {
  return error instanceof Error && /constraint/i.test(error.message);
}

function toNullable(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseIsoDate(value: string, fieldName: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `Invalid ${fieldName} format: ${value}. Use ISO format.`);
  }
  return date.toISOString();
}

function parsePathInt(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new HttpError(400, `Invalid ${fieldName}`);
  }
  return parsed;
}

function parseIntegerOrDefault(
  value: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
  fieldName: string,
): number {
  if (value == null) {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

function loadEvent(db: Database, eventId: number): EventRow {
  const event = db.query('SELECT * FROM events WHERE id = ?').get(eventId) as EventRow | null;
  if (!event) {
    throw new HttpError(404, 'Event not found');
  }
  return event;
}

function getEventProperties(db: Database, eventId: number): EventPropertyRow[] {
  return db
    .query(
      `SELECT *
       FROM event_properties
       WHERE event_id = ?
       ORDER BY property_type ASC, property_name ASC`,
    )
    .all(eventId) as EventPropertyRow[];
}

function csvEscape(value: string): string {
  if (/[,"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function scoreEvent(event: Record<string, unknown>, searchTerm: string): number {
  let score = 0;

  const name = String(event.name ?? '').toLowerCase();
  const category = String(event.category ?? '').toLowerCase();
  const description = String(event.description ?? '').toLowerCase();
  const createdBy = String(event.created_by ?? '').toLowerCase();

  if (name.includes(searchTerm)) {
    score += 100;
    if (name === searchTerm) {
      score += 50;
    }
  }

  if (category.includes(searchTerm)) {
    score += 75;
    if (category === searchTerm) {
      score += 25;
    }
  }

  if (description.includes(searchTerm)) {
    score += 50;
  }

  const properties = Array.isArray(event.properties)
    ? (event.properties as Array<Record<string, unknown>>)
    : [];
  for (const prop of properties) {
    const propertyName = String(prop.property_name ?? '').toLowerCase();
    const propertyDescription = String(prop.description ?? '').toLowerCase();
    const dataType = String(prop.data_type ?? '').toLowerCase();

    if (propertyName.includes(searchTerm)) {
      score += 30;
      if (propertyName === searchTerm) {
        score += 10;
      }
    }

    if (propertyDescription.includes(searchTerm)) {
      score += 20;
    }

    if (dataType.includes(searchTerm)) {
      score += 10;
    }
  }

  if (createdBy.includes(searchTerm)) {
    score += 15;
  }

  return score;
}
