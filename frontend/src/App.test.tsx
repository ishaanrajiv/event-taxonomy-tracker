import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';
import App from './App';

vi.mock('axios');

const mockedAxios = vi.mocked(axios, { deep: true });

const mockSuccessfulBootstrap = () => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.endsWith('/events')) return Promise.resolve({ data: [] });
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
});
