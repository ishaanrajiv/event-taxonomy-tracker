import { http, HttpResponse } from 'msw';
import type { ChangelogEntry, Event, FilterOptions, Property } from '../../types/api';

const API_BASE = 'http://localhost:8000/api';

const mockEvents: Event[] = [
  {
    id: 1,
    name: 'User Signed Up',
    description: 'Triggered when a user creates a new account',
    category: 'User',
    created_by: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    version_number: 1,
    is_archived: false,
    archived_at: null,
    archived_by: null,
    lock_version: 1,
    properties: [
      {
        id: 1,
        property_id: 1,
        property_name: 'user_id',
        property_type: 'user',
        data_type: 'String',
        is_required: true,
        example_value: 'usr_123',
        description: 'Unique user identifier',
      },
    ],
  },
];

const mockProperties: Property[] = [
  {
    id: 1,
    name: 'user_id',
    data_type: 'String',
    description: 'Unique user identifier',
    created_by: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
  },
];

const mockChangelog: ChangelogEntry[] = [
  {
    id: 1,
    entity_type: 'event',
    entity_id: 1,
    event_name: 'User Signed Up',
    version_number: 1,
    action: 'create',
    summary: 'Created event with 1 property',
    change_reason: null,
    diff: {
      metadata: {
        name: { from: null, to: 'User Signed Up' },
      },
      properties: {
        added: [
          {
            property_name: 'user_id',
            property_type: 'user',
            data_type: 'String',
            is_required: true,
            example_value: 'usr_123',
            description: 'Unique user identifier',
          },
        ],
        removed: [],
        updated: [],
      },
    },
    snapshot: {
      event: {
        name: 'User Signed Up',
        description: 'Triggered when a user creates a new account',
        category: 'User',
        is_archived: false,
      },
      properties: [
        {
          property_name: 'user_id',
          property_type: 'user',
          data_type: 'String',
          is_required: true,
          example_value: 'usr_123',
          description: 'Unique user identifier',
        },
      ],
    },
    changed_by: 'Test User',
    changed_at: '2024-01-01T00:00:00Z',
    is_current: true,
  },
];

const mockFilterOptions: FilterOptions = {
  categories: ['User', 'Engagement', 'Transaction'],
  creators: ['Test User'],
  date_range: {
    min: '2024-01-01',
    max: '2024-12-31',
  },
};

const asObject = (value: unknown): Record<string, unknown> => {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
};

export const handlers = [
  http.get(`${API_BASE}/events`, () => HttpResponse.json(mockEvents)),
  http.get(`${API_BASE}/properties`, () => HttpResponse.json(mockProperties)),
  http.get(`${API_BASE}/changelog`, () => HttpResponse.json(mockChangelog)),
  http.get(`${API_BASE}/filter-options`, () => HttpResponse.json(mockFilterOptions)),

  http.post(`${API_BASE}/events`, async ({ request }) => {
    const body = asObject(await request.json());
    return HttpResponse.json(
      {
        id: 2,
        version_number: 1,
        is_archived: false,
        archived_at: null,
        archived_by: null,
        lock_version: 1,
        properties: [],
        ...body,
      },
      { status: 201 }
    );
  }),

  http.put(`${API_BASE}/events/:id`, async ({ request, params }) => {
    const body = asObject(await request.json());
    return HttpResponse.json({
      id: Number(params.id),
      version_number: Number(body.base_version_number || 1) + 1,
      is_archived: false,
      archived_at: null,
      archived_by: null,
      lock_version: Number(body.base_version_number || 1) + 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      created_by: 'Test User',
      ...body,
    });
  }),

  http.post(`${API_BASE}/events/:id/archive`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.post(`${API_BASE}/events/:id/restore`, () => {
    return HttpResponse.json({ success: true });
  }),
];
