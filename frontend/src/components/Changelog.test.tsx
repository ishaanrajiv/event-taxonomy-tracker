import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Changelog from './Changelog';
import type { ChangelogEntry } from '../types/api';

describe('Changelog', () => {
  it('safely handles malformed change payloads', () => {
    const malformedEntries: ChangelogEntry[] = [
      {
        id: 1,
        entity_type: 'event',
        entity_id: 11,
        action: 'update',
        old_value: null,
        new_value: {
          action: 'property_added',
          property: 'not-an-object',
        },
        changed_by: 'tester@example.com',
        changed_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 2,
        entity_type: 'event',
        entity_id: 12,
        action: 'create',
        old_value: null,
        new_value: {
          name: 'Created Event',
          properties: { invalid: true },
        },
        changed_by: 'tester@example.com',
        changed_at: '2024-01-01T00:00:00Z',
      },
    ];

    render(<Changelog changelog={malformedEntries} />);

    expect(screen.getByText('Changelog')).toBeInTheDocument();
    expect(screen.queryByText(/Added property:/)).not.toBeInTheDocument();
    expect(screen.getByText('event "Created Event"')).toBeInTheDocument();
  });
});
