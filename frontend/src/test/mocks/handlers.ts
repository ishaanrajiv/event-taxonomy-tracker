import { http, HttpResponse } from 'msw';
import type { Event, Property, ChangelogEntry, FilterOptions } from '../../types/api';

const API_BASE = 'http://localhost:8000/api';

// Mock data
const mockEvents: Event[] = [
  {
    id: 1,
    name: 'User Signed Up',
    description: 'Triggered when a user creates a new account',
    category: 'User',
    created_by: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    properties: [
      {
        id: 1,
        property_id: 1,
        property_name: 'user_id',
        property_type: 'user',
        data_type: 'string',
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
    data_type: 'string',
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
    action: 'create',
    old_value: null,
    new_value: { name: 'User Signed Up' },
    changed_by: 'Test User',
    changed_at: '2024-01-01T00:00:00Z',
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

export const handlers = [
  // GET /api/events
  http.get(`${API_BASE}/events`, () => {
    return HttpResponse.json(mockEvents);
  }),

  // GET /api/properties
  http.get(`${API_BASE}/properties`, () => {
    return HttpResponse.json(mockProperties);
  }),

  // GET /api/changelog
  http.get(`${API_BASE}/changelog`, () => {
    return HttpResponse.json(mockChangelog);
  }),

  // GET /api/filter-options
  http.get(`${API_BASE}/filter-options`, () => {
    return HttpResponse.json(mockFilterOptions);
  }),

  // POST /api/events
  http.post(`${API_BASE}/events`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 2, ...body }, { status: 201 });
  }),

  // PUT /api/events/:id
  http.put(`${API_BASE}/events/:id`, async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({ id: Number(params.id), ...body });
  }),

  // DELETE /api/events/:id
  http.delete(`${API_BASE}/events/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
