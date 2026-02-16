import React, { useState, useEffect } from 'react';
import { ActiveFilters, FilterOptions } from '../types/api';

interface FilterBarProps {
  filters: ActiveFilters;
  onFiltersChange: (filters: ActiveFilters) => void;
  filterOptions: FilterOptions;
  onToggle: () => void;
  isExpanded: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  filterOptions,
  onToggle: _onToggle,
  isExpanded,
}) => {
  const [localFilters, setLocalFilters] = useState<ActiveFilters>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    const newFilters = { ...localFilters, category: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleCreatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    const newFilters = { ...localFilters, creator: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || undefined;
    const newFilters = { ...localFilters, dateFrom: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value || undefined;
    const newFilters = { ...localFilters, dateTo: value };
    setLocalFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearFilters = () => {
    const emptyFilters: ActiveFilters = {};
    setLocalFilters(emptyFilters);
    onFiltersChange(emptyFilters);
  };

  const hasActiveFilters = Object.values(localFilters).some(v => v !== undefined);

  const isDateRangeInvalid = Boolean(
    localFilters.dateFrom &&
    localFilters.dateTo &&
    localFilters.dateFrom > localFilters.dateTo
  );

  if (!isExpanded) return null;

  return (
    <div className="mb-5 p-4 bg-card rounded-lg border border-border/60 animate-slide-down">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="filter-category" className="block text-[11px] font-semibold text-foreground mb-1.5">
            Category
          </label>
          <select
            id="filter-category"
            value={localFilters.category || ''}
            onChange={handleCategoryChange}
            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
          >
            <option value="">All</option>
            {filterOptions.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-creator" className="block text-[11px] font-semibold text-foreground mb-1.5">
            Creator
          </label>
          <select
            id="filter-creator"
            value={localFilters.creator || ''}
            onChange={handleCreatorChange}
            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all"
          >
            <option value="">All</option>
            {filterOptions.creators.map((creator) => (
              <option key={creator} value={creator}>
                {creator}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-date-from" className="block text-[11px] font-semibold text-foreground mb-1.5">
            From
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={localFilters.dateFrom || ''}
            onChange={handleDateFromChange}
            max={localFilters.dateTo || undefined}
            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all font-mono"
          />
        </div>

        <div>
          <label htmlFor="filter-date-to" className="block text-[11px] font-semibold text-foreground mb-1.5">
            To
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={localFilters.dateTo || ''}
            onChange={handleDateToChange}
            min={localFilters.dateFrom || undefined}
            className="w-full h-8 px-2.5 text-xs border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary/50 transition-all font-mono"
          />
        </div>
      </div>

      {isDateRangeInvalid && (
        <p className="mt-2 text-[11px] text-destructive font-medium">
          From date must be earlier than or equal to To date.
        </p>
      )}
    </div>
  );
};

export default FilterBar;
