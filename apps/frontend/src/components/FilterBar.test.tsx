import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FilterBar from './FilterBar';
import type { FilterOptions } from '../types/api';

const filterOptions: FilterOptions = {
  categories: ['Engagement', 'Navigation'],
  creators: ['tester@example.com'],
  date_range: {
    min: '2024-01-01',
    max: '2024-12-31',
  },
};

describe('FilterBar', () => {
  it('returns null when collapsed', () => {
    const { container } = render(
      <FilterBar
        filters={{ category: 'Engagement' }}
        onFiltersChange={vi.fn()}
        filterOptions={filterOptions}
        onToggle={vi.fn()}
        isExpanded={false}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('renders clear button and clears filters when expanded with active filters', () => {
    const onFiltersChange = vi.fn();

    render(
      <FilterBar
        filters={{ category: 'Engagement' }}
        onFiltersChange={onFiltersChange}
        filterOptions={filterOptions}
        onToggle={vi.fn()}
        isExpanded={true}
      />
    );

    const clearButton = screen.getByRole('button', { name: /clear all/i });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('shows a validation message for an invalid date range', () => {
    render(
      <FilterBar
        filters={{}}
        onFiltersChange={vi.fn()}
        filterOptions={filterOptions}
        onToggle={vi.fn()}
        isExpanded
      />
    );

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2024-12-31' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2024-01-01' } });

    expect(
      screen.getByText('From date must be earlier than or equal to To date.')
    ).toBeInTheDocument();
  });
});
