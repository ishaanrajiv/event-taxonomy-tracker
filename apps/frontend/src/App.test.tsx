import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import App from './App';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, { deep: true });

const mockSuccessfulBootstrap = () => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.endsWith('/events')) return Promise.resolve({ data: [], headers: {} });
    if (url.endsWith('/properties')) return Promise.resolve({ data: [] });
    if (url.endsWith('/changelog')) return Promise.resolve({ data: [] });
    if (url.endsWith('/filter-options')) {
      return Promise.resolve({
        data: { categories: [], creators: [], date_range: { min: null, max: null } },
      });
    }
    if (url.endsWith('/features')) {
      return Promise.resolve({ data: { recent: [], all: [], default: 'Engagement' } });
    }
    return Promise.resolve({ data: [] });
  });
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.isAxiosError.mockImplementation((value: unknown): value is Error => {
      return typeof value === 'object' && value !== null && 'isAxiosError' in value;
    });
    mockSuccessfulBootstrap();
  });

  it('surfaces backend filter errors in a toast', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.endsWith('/events')) {
        return Promise.reject({
          isAxiosError: true,
          response: { data: { detail: 'Invalid date_from format: bad-date' } },
        });
      }
      if (url.endsWith('/filter-options')) {
        return Promise.resolve({
          data: { categories: [], creators: [], date_range: { min: null, max: null } },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Invalid date_from format: bad-date')).toBeInTheDocument();
    });
  });

  it('shows a toast when date range is invalid', async () => {
    render(<App />);

    // Click the Filters button in App.tsx to expand the FilterBar
    fireEvent.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-12-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-01-01' } });

    await waitFor(() => {
      expect(
        screen.getByText('Created From date must be earlier than or equal to Created To date.')
      ).toBeInTheDocument();
    });
  });

  it('toggles created sort order from asc to desc', async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/events',
        expect.objectContaining({
          params: expect.objectContaining({ sort_order: 'asc' }),
        })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /toggle sort order/i }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:8000/api/events',
        expect.objectContaining({
          params: expect.objectContaining({ sort_order: 'desc' }),
        })
      );
    });
  });

  it('shows search/sort/filter controls only on the Events tab', async () => {
    render(<App />);

    expect(screen.getByPlaceholderText('Search events...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle sort order/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Properties' }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Search events...')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /toggle sort order/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /filters/i })).not.toBeInTheDocument();
    });
  });

  it('opens create modal with duplicated event details and a copied name suffix', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url.endsWith('/events')) {
        return Promise.resolve({
          data: [
            {
              id: 1,
              name: 'Checkout Started',
              description: 'User initiated checkout',
              category: 'Transaction',
              created_by: 'user@example.com',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2025-01-02T00:00:00Z',
              version_number: 4,
              is_archived: false,
              archived_at: null,
              archived_by: null,
              lock_version: 4,
              properties: [
                {
                  id: 10,
                  property_id: 10,
                  property_name: 'cart_value',
                  property_type: 'event',
                  data_type: 'Float',
                  is_required: false,
                  example_value: '99.99',
                  description: 'Cart total',
                },
              ],
            },
          ],
          headers: { 'x-total-count': '1' },
        });
      }
      if (url.endsWith('/properties')) return Promise.resolve({ data: [] });
      if (url.endsWith('/changelog')) return Promise.resolve({ data: [] });
      if (url.endsWith('/filter-options')) {
        return Promise.resolve({
          data: { categories: ['Transaction'], creators: ['user@example.com'], date_range: { min: null, max: null } },
        });
      }
      if (url.endsWith('/features')) {
        return Promise.resolve({ data: { recent: ['Transaction'], all: ['Transaction'], default: 'Transaction' } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Checkout Started')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Duplicate event' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Event' })).toBeInTheDocument();
      expect(screen.getByDisplayValue('Checkout Started - Copy')).toBeInTheDocument();
      expect(screen.getByDisplayValue('User initiated checkout')).toBeInTheDocument();
    });
  });
});
