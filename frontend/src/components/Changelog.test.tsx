import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Changelog from './Changelog';
import type { ChangelogEntry } from '../types/api';

describe('Changelog', () => {
  it('renders parsed changes for non-create entries', () => {
    const entries: ChangelogEntry[] = [
      {
        id: 1,
        entity_type: 'event',
        entity_id: 11,
        event_name: 'Created Event',
        version_number: 2,
        action: 'revert',
        summary: 'Reverted to version 1',
        change_reason: 'Undo bad update',
        diff: {
          metadata: {
            name: { from: 'Broken Event', to: 'Created Event' },
          },
          properties: {
            added: [],
            removed: [],
            updated: [],
          },
        },
        snapshot: {
          event: {
            name: 'Created Event',
            description: 'restored',
            category: 'Engagement',
            is_archived: false,
          },
          properties: [],
        },
        changed_by: 'tester@example.com',
        changed_at: '2024-01-01T00:00:00Z',
        is_current: true,
      },
    ];

    render(<Changelog changelog={entries} />);

    expect(screen.getByText('Changelog')).toBeInTheDocument();
    expect(screen.getByText('Created Event')).toBeInTheDocument();
    expect(screen.getByText('Reverted to version 1')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Created Event'));

    expect(screen.getByText('Parsed changes')).toBeInTheDocument();
    expect(screen.getByText('Event name changed from Broken Event to Created Event')).toBeInTheDocument();
    expect(screen.queryByText('Structured Diff')).not.toBeInTheDocument();
  });

  it('renders a creation summary instead of empty-value diffs for create entries', () => {
    const entries: ChangelogEntry[] = [
      {
        id: 2,
        entity_type: 'event',
        entity_id: 12,
        event_name: 'Checkout Started',
        version_number: 1,
        action: 'create',
        summary: 'Created event with 2 properties',
        change_reason: 'Initial tracking setup',
        diff: {
          metadata: {
            name: { from: null, to: 'Checkout Started' },
            description: { from: null, to: 'User entered checkout' },
          },
          properties: {
            added: [
              {
                property_name: 'cart_id',
                property_type: 'event',
                data_type: 'String',
                is_required: true,
                example_value: 'cart_123',
                description: 'Cart identifier',
              },
            ],
            removed: [],
            updated: [],
          },
        },
        snapshot: {
          event: {
            name: 'Checkout Started',
            description: 'User entered checkout',
            category: 'Transaction',
            is_archived: false,
          },
          properties: [
            {
              property_name: 'cart_id',
              property_type: 'event',
              data_type: 'String',
              is_required: true,
              example_value: 'cart_123',
              description: 'Cart identifier',
            },
            {
              property_name: 'coupon_code',
              property_type: 'event',
              data_type: 'String',
              is_required: false,
              example_value: '',
              description: '',
            },
          ],
        },
        changed_by: 'tester@example.com',
        changed_at: '2024-01-01T00:00:00Z',
        is_current: true,
      },
    ];

    render(<Changelog changelog={entries} />);

    fireEvent.click(screen.getByText('Checkout Started'));

    expect(screen.getByText('Creation summary')).toBeInTheDocument();
    expect(screen.getAllByText('Initial definition')).toHaveLength(2);
    expect(screen.getByText('Initial properties')).toBeInTheDocument();
    expect(screen.queryByText('Event name set to Checkout Started')).not.toBeInTheDocument();
    expect(screen.queryByText('Parsed changes')).not.toBeInTheDocument();
  });
});
