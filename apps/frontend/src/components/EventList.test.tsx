import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import EventList from './EventList';
import { Event } from '../types/api';

describe('EventList', () => {
  const writeText = vi.fn();

  const event: Event = {
    id: 42,
    name: 'Checkout Started',
    description: 'User initiated checkout',
    category: 'Transaction',
    created_by: 'ios@example.com',
    created_at: '2026-02-27T00:00:00Z',
    updated_at: '2026-02-27T00:00:00Z',
    version_number: 3,
    is_archived: false,
    archived_at: null,
    archived_by: null,
    lock_version: 3,
    properties: [
      {
        id: 1,
        property_id: 100,
        property_name: 'cart_id',
        property_type: 'event',
        data_type: 'String',
        description: 'Unique cart identifier',
        is_required: true,
        example_value: 'cart_123'
      },
      {
        id: 2,
        property_id: 101,
        property_name: 'cart_total',
        property_type: 'event',
        data_type: 'Float',
        description: 'Order total',
        is_required: false,
        example_value: '149.99'
      }
    ]
  };

  beforeEach(() => {
    writeText.mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
  });

  it('opens the iOS snippet viewer and copies the coding agent prompt', async () => {
    const onCopySuccess = vi.fn();
    const onCopyError = vi.fn();

    render(
      <EventList
        events={[event]}
        loading={false}
        totalEvents={1}
        currentPage={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDuplicateEvent={vi.fn()}
        onArchiveEvent={vi.fn()}
        onRestoreEvent={vi.fn()}
        onOpenHistory={vi.fn()}
        onCopySuccess={onCopySuccess}
        onCopyError={onCopyError}
      />
    );

    expect(screen.getAllByRole('button', { name: /Open .* snippets/i })).toHaveLength(2);
    expect(screen.queryByText('v3')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Checkout Started'));

    expect(screen.getByText('Current definition')).toBeInTheDocument();
    expect(screen.getByText('v3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open iOS snippets' }));

    expect(screen.getByRole('heading', { name: 'iOS Implementation' })).toBeInTheDocument();
    expect((screen.getByLabelText('iOS code snippet content') as HTMLTextAreaElement).value).toContain(
      'Analytics.shared.track(name: "Checkout Started"'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Coding agent prompt' }));

    expect((screen.getByLabelText('iOS coding agent prompt content') as HTMLTextAreaElement).value).toContain(
      'You are updating an existing iOS codebase to add one analytics event.'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy iOS coding agent prompt' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('You are updating an existing iOS codebase to add one analytics event.'));
    });

    const copiedPrompt = writeText.mock.calls[0][0] as string;

    expect(copiedPrompt).toContain('Read any applicable instruction files before coding');
    expect(copiedPrompt).toContain('nearest `AGENTS.md`');
    expect(copiedPrompt).toContain('- Event name: `Checkout Started`');
    expect(copiedPrompt).toContain('`cart_id` | scope: `event` | type: `String` | required: `yes` | example: `"cart_123"`');
    expect(copiedPrompt).toContain('- Verification performed');
    expect(onCopySuccess).toHaveBeenCalledWith('Copied iOS coding agent prompt for Checkout Started');
    expect(onCopyError).not.toHaveBeenCalled();
  });

  it('opens the Android snippet viewer with the Android code tab by default', () => {
    render(
      <EventList
        events={[event]}
        loading={false}
        totalEvents={1}
        currentPage={1}
        pageSize={25}
        onPageChange={vi.fn()}
        onCreateEvent={vi.fn()}
        onEditEvent={vi.fn()}
        onDuplicateEvent={vi.fn()}
        onArchiveEvent={vi.fn()}
        onRestoreEvent={vi.fn()}
        onOpenHistory={vi.fn()}
        onCopySuccess={vi.fn()}
        onCopyError={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Android snippets' }));

    expect(screen.getByRole('heading', { name: 'Android Implementation' })).toBeInTheDocument();
    expect((screen.getByLabelText('Android code snippet content') as HTMLTextAreaElement).value).toContain(
      'analytics.track("Checkout Started", Properties()'
    );
  });
});
