import { beforeEach, afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createApp } from '../src/app';
import { initDatabase } from '../src/db';

const sampleEventData = {
  name: 'Test Event',
  description: 'A test event',
  category: 'Testing',
  created_by: 'pytest',
  properties: [
    {
      property_name: 'test_property',
      property_type: 'event',
      data_type: 'String',
      is_required: true,
      example_value: 'test_value',
      description: 'A test property',
    },
  ],
};

const samplePropertyData = {
  name: 'test_prop',
  data_type: 'String',
  description: 'Test property',
  created_by: 'pytest',
};

function buildUpdatePayload(baseVersionNumber: number, overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test Event',
    description: 'A test event',
    category: 'Testing',
    base_version_number: baseVersionNumber,
    changed_by: 'pytest',
    properties: [
      {
        property_name: 'test_property',
        property_type: 'event',
        data_type: 'String',
        is_required: true,
        example_value: 'test_value',
        description: 'A test property',
      },
    ],
    ...overrides,
  };
}

type ApiHarness = {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  db: Database;
};

let harness: ApiHarness;

beforeEach(() => {
  const db = new Database(':memory:');
  initDatabase(db);
  const { app } = createApp({ db });

  harness = {
    db,
    request: (path: string, init?: RequestInit) => Promise.resolve(app.request(path, init)),
  };
});

afterEach(() => {
  harness.db.close();
});

async function requestJson(path: string, init?: RequestInit): Promise<{ response: Response; data: any }> {
  const response = await harness.request(path, init);
  const data = await response.json();
  return { response, data };
}

describe('Event Version Endpoints', () => {
  test('create event creates version one', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    expect(created.response.status).toBe(200);
    expect(created.data.name).toBe(sampleEventData.name);
    expect(created.data.version_number).toBe(1);
    expect(created.data.is_archived).toBe(false);
    expect(created.data.properties).toHaveLength(1);

    const versions = await requestJson(`/api/events/${created.data.id}/versions`);
    expect(versions.response.status).toBe(200);
    expect(versions.data).toHaveLength(1);
    expect(versions.data[0].action).toBe('create');
    expect(versions.data[0].version_number).toBe(1);
    expect(versions.data[0].is_current).toBe(true);

    const detail = await requestJson(`/api/events/${created.data.id}/versions/1`);
    expect(detail.response.status).toBe(200);
    expect(detail.data.snapshot.event.name).toBe(sampleEventData.name);
    expect(detail.data.diff.properties.added).toHaveLength(1);
  });

  test('update event creates new version and metadata diff', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    const updated = await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildUpdatePayload(1, {
          name: 'Updated Event',
          description: 'Updated description',
          category: 'Updated',
        }),
      ),
    });

    expect(updated.response.status).toBe(200);
    expect(updated.data.version_number).toBe(2);
    expect(updated.data.name).toBe('Updated Event');

    const detail = await requestJson(`/api/events/${created.data.id}/versions/2`);
    expect(detail.data.diff.metadata.name).toEqual({ from: 'Test Event', to: 'Updated Event' });
    expect(detail.data.diff.metadata.category).toEqual({ from: 'Testing', to: 'Updated' });
  });

  test('property only update creates property diff', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    const updated = await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildUpdatePayload(1, {
          properties: [
            {
              property_name: 'test_property',
              property_type: 'event',
              data_type: 'String',
              is_required: true,
              example_value: 'test_value',
              description: 'A test property',
            },
            {
              property_name: 'another_property',
              property_type: 'user',
              data_type: 'Int',
              is_required: false,
              example_value: '123',
              description: 'Another property',
            },
          ],
        }),
      ),
    });

    expect(updated.response.status).toBe(200);
    expect(updated.data.version_number).toBe(2);
    expect(updated.data.properties).toHaveLength(2);

    const detail = await requestJson(`/api/events/${created.data.id}/versions/2`);
    expect(detail.data.diff.properties.added[0].property_name).toBe('another_property');
    expect(detail.data.diff.properties.removed).toHaveLength(0);
  });

  test('noop update does not create new version', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    const response = await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1)),
    });

    expect(response.response.status).toBe(200);
    expect(response.data.version_number).toBe(1);

    const versions = await requestJson(`/api/events/${created.data.id}/versions`);
    expect(versions.data).toHaveLength(1);
  });

  test('stale base version returns 409', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1, { description: 'Fresh change' })),
    });

    const stale = await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1, { description: 'Stale change' })),
    });

    expect(stale.response.status).toBe(409);
    expect(stale.data.detail).toContain('Current version is 2');
  });

  test('archive restore and archived filters', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    const archived = await requestJson(`/api/events/${created.data.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 1, changed_by: 'pytest', change_reason: 'cleanup' }),
    });

    expect(archived.response.status).toBe(200);
    expect(archived.data.is_archived).toBe(true);
    expect(archived.data.version_number).toBe(2);

    const visible = await requestJson('/api/events');
    expect(visible.data).toEqual([]);

    const all = await requestJson('/api/events?include_archived=true');
    expect(all.data).toHaveLength(1);
    expect(all.data[0].is_archived).toBe(true);

    const archivedOnly = await requestJson('/api/events?only_archived=true');
    expect(archivedOnly.data).toHaveLength(1);
    expect(archivedOnly.data[0].id).toBe(created.data.id);

    const restored = await requestJson(`/api/events/${created.data.id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 2, changed_by: 'pytest', change_reason: 'bring back' }),
    });

    expect(restored.response.status).toBe(200);
    expect(restored.data.is_archived).toBe(false);
    expect(restored.data.version_number).toBe(3);
  });

  test('archived event cannot be edited', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 1, changed_by: 'pytest' }),
    });

    const response = await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(2, { description: 'Should fail' })),
    });

    expect(response.response.status).toBe(409);
    expect(response.data.detail).toContain('must be restored');
  });

  test('revert creates new head version', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1, { name: 'Version Two' })),
    });

    await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildUpdatePayload(2, {
          name: 'Version Three',
          properties: [
            {
              property_name: 'test_property',
              property_type: 'event',
              data_type: 'String',
              is_required: true,
              example_value: 'test_value',
              description: 'A test property',
            },
            {
              property_name: 'cart_value',
              property_type: 'event',
              data_type: 'Float',
              is_required: false,
              example_value: '19.99',
              description: 'Cart value',
            },
          ],
        }),
      ),
    });

    const reverted = await requestJson(`/api/events/${created.data.id}/versions/1/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 3, changed_by: 'pytest', change_reason: 'undo' }),
    });

    expect(reverted.response.status).toBe(200);
    expect(reverted.data.version_number).toBe(4);
    expect(reverted.data.name).toBe('Test Event');
    expect(reverted.data.properties).toHaveLength(1);

    const versions = await requestJson(`/api/events/${created.data.id}/versions`);
    expect(versions.data[0].action).toBe('revert');
    expect(versions.data[0].reverted_from_version_number).toBe(1);
  });

  test('revert with stale base version returns 409', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1, { name: 'Version Two' })),
    });

    const response = await requestJson(`/api/events/${created.data.id}/versions/1/revert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 1, changed_by: 'pytest' }),
    });

    expect(response.response.status).toBe(409);
  });

  test('registry conflict still returns 400', async () => {
    await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Seed Event',
        properties: [{ property_name: 'conflicting_prop', property_type: 'event', data_type: 'String' }],
      }),
    });

    const response = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Conflicting Event',
        properties: [{ property_name: 'conflicting_prop', property_type: 'event', data_type: 'Int' }],
      }),
    });

    expect(response.response.status).toBe(400);
    expect(response.data.detail).toContain('already exists with data type');
  });
});

describe('Property Endpoints', () => {
  test('create property', async () => {
    const response = await requestJson('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePropertyData),
    });

    expect(response.response.status).toBe(200);
    expect(response.data.name).toBe(samplePropertyData.name);
    expect(response.data.data_type).toBe(samplePropertyData.data_type);
  });

  test('create duplicate property', async () => {
    await requestJson('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePropertyData),
    });

    const response = await requestJson('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePropertyData),
    });

    expect(response.response.status).toBe(400);
  });

  test('list properties tolerates legacy invalid data type', async () => {
    const now = new Date().toISOString();
    harness.db
      .query('INSERT INTO properties (name, data_type, description, created_at, created_by) VALUES (?, ?, ?, ?, ?)')
      .run('legacy_only_prop', 'WeirdType', null, now, null);

    const response = await requestJson('/api/properties');
    expect(response.response.status).toBe(200);

    const legacy = response.data.find((prop: any) => prop.name === 'legacy_only_prop');
    expect(legacy.data_type).toBe('WeirdType');
  });

  test('suggest properties', async () => {
    await requestJson('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePropertyData),
    });

    const response = await requestJson('/api/properties/suggest?q=test');
    expect(response.response.status).toBe(200);
    expect(response.data.query).toBe('test');
    expect(Array.isArray(response.data.suggestions)).toBe(true);
  });
});

describe('Changelog and Search Endpoints', () => {
  test('changelog reads from versions', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUpdatePayload(1, { name: 'Updated Event' })),
    });

    const response = await requestJson('/api/changelog');
    expect(response.response.status).toBe(200);
    expect(response.data[0].action).toBe('update');
    expect(response.data[0].version_number).toBe(2);
    expect(response.data[1].action).toBe('create');
  });

  test('global search excludes archived events', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 1, changed_by: 'pytest' }),
    });

    const response = await requestJson('/api/search?q=Test');
    expect(response.response.status).toBe(200);
    expect(response.data.events).toEqual([]);
  });

  test('features and filter options ignore archived events', async () => {
    const created = await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sampleEventData),
    });

    await requestJson(`/api/events/${created.data.id}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_version_number: 1, changed_by: 'pytest' }),
    });

    const features = await requestJson('/api/features');
    expect(features.response.status).toBe(200);
    expect(features.data.all).toEqual([]);

    const filterOptions = await requestJson('/api/filter-options');
    expect(filterOptions.response.status).toBe(200);
    expect(filterOptions.data.categories).toEqual([]);
  });
});

describe('Bulk Operations', () => {
  test('download json template', async () => {
    const response = await harness.request('/api/export/template/json');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  test('download csv template', async () => {
    const response = await harness.request('/api/export/template/csv');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
  });

  test('import json creates versioned events', async () => {
    const payload = [
      {
        name: 'Imported Event',
        description: 'from json',
        category: 'Import',
        properties: [
          {
            property_name: 'source',
            property_type: 'event',
            data_type: 'String',
          },
        ],
      },
    ];

    const formData = new FormData();
    formData.set('file', new File([JSON.stringify(payload)], 'events.json', { type: 'application/json' }));

    const response = await requestJson('/api/import/json', {
      method: 'POST',
      body: formData,
    });

    expect(response.response.status).toBe(200);
    expect(response.data.imported).toBe(1);

    const events = await requestJson('/api/events?q=Imported');
    expect(events.data).toHaveLength(1);

    const versions = await requestJson(`/api/events/${events.data[0].id}/versions`);
    expect(versions.data).toHaveLength(1);
    expect(versions.data[0].version_number).toBe(1);
  });

  test('import csv rolls back event on property conflict', async () => {
    await requestJson('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Seed Event CSV',
        properties: [
          {
            property_name: 'conflicting_csv_prop',
            property_type: 'event',
            data_type: 'String',
          },
        ],
      }),
    });

    const csvContent =
      'event_name,event_description,event_category,property_name,property_type,data_type,is_required,example_value,property_description\n' +
      'Import CSV Conflict Event,desc,Engagement,conflicting_csv_prop,event,Int,true,,\n';

    const formData = new FormData();
    formData.set('file', new File([csvContent], 'events.csv', { type: 'text/csv' }));

    const response = await requestJson('/api/import/csv', {
      method: 'POST',
      body: formData,
    });

    expect(response.response.status).toBe(200);
    expect(response.data.imported).toBe(0);

    const events = await requestJson('/api/events?q=Import CSV Conflict Event');
    expect(events.data).toEqual([]);
  });
});

describe('Root Endpoint', () => {
  test('root', async () => {
    const response = await requestJson('/');
    expect(response.response.status).toBe(200);
    expect(response.data.message).toBe('Event Taxonomy Tracker API');
    expect(response.data.version).toBe('2.0.0');
  });
});
