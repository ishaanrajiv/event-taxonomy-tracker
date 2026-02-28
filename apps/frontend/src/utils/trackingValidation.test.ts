import { describe, expect, it } from 'vitest';
import { Event, Property } from '../types/api';
import { buildTrackingValidationSummary } from './trackingValidation';

const buildEvent = (overrides: Partial<Event>): Event => ({
  id: 1,
  name: 'Checkout Started',
  description: 'User began checkout',
  category: 'Transaction',
  created_by: 'qa@example.com',
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-01-01T00:00:00Z',
  version_number: 1,
  is_archived: false,
  archived_at: null,
  archived_by: null,
  lock_version: 1,
  properties: [],
  ...overrides,
});

const buildProperty = (overrides: Partial<Property>): Property => ({
  id: 1,
  name: 'order_id',
  data_type: 'String',
  description: 'Unique order identifier',
  created_by: 'qa@example.com',
  created_at: '2025-01-01T00:00:00Z',
  ...overrides,
});

describe('buildTrackingValidationSummary', () => {
  it('returns all passing checks for clean taxonomy data', () => {
    const events: Event[] = [
      buildEvent({
        id: 1,
        name: 'Checkout Started',
        properties: [
          {
            id: 11,
            property_id: 11,
            property_name: 'order_id',
            property_type: 'event',
            data_type: 'String',
            is_required: true,
            example_value: 'ord_123',
            description: 'Unique order id',
          },
        ],
      }),
    ];

    const properties: Property[] = [buildProperty({ id: 11, name: 'order_id', data_type: 'String' })];

    const result = buildTrackingValidationSummary(events, properties);

    expect(result.warningChecks).toBe(0);
    expect(result.warningItems).toBe(0);
    expect(result.passChecks).toBe(result.checks.length);
  });

  it('detects duplicate events, missing descriptions, and similar property names', () => {
    const events: Event[] = [
      buildEvent({ id: 1, name: 'checkout started', description: '' }),
      buildEvent({ id: 2, name: 'Checkout Started', description: null }),
    ];

    const properties: Property[] = [
      buildProperty({ id: 1, name: 'user_id', description: '' }),
      buildProperty({ id: 2, name: 'userId', description: null }),
    ];

    const result = buildTrackingValidationSummary(events, properties);

    const duplicateNameCheck = result.checks.find((check) => check.id === 'unique-event-names');
    const titleCaseCheck = result.checks.find((check) => check.id === 'event-title-case');
    const similarPropertyCheck = result.checks.find((check) => check.id === 'similar-property-names');
    const eventDescriptionCheck = result.checks.find((check) => check.id === 'event-description');

    expect(duplicateNameCheck?.status).toBe('warning');
    expect(titleCaseCheck?.status).toBe('warning');
    expect(similarPropertyCheck?.status).toBe('warning');
    expect(eventDescriptionCheck?.status).toBe('warning');
    expect(result.warningChecks).toBeGreaterThan(0);
    expect(result.warningItems).toBeGreaterThan(0);
  });
});
