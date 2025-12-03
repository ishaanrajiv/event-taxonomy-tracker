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
  onToggle,
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

  // Count active filters
  const activeFilterCount = Object.values(localFilters).filter(v => v !== undefined).length;

  return (
    <div className="mb-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Filter Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500 text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearFilters();
            }}
            className="px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Clear all
          </button>
        )}
      </button>

      {/* Filter Options */}
      {isExpanded && (
        <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Feature
            </label>
            <select
              value={localFilters.category || ''}
              onChange={handleCategoryChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* Creator Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Creator
            </label>
            <select
              value={localFilters.creator || ''}
              onChange={handleCreatorChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Creators</option>
              {filterOptions.creators.map((creator) => (
                <option key={creator} value={creator}>
                  {creator}
                </option>
              ))}
            </select>
          </div>

          {/* Date From Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Created From
            </label>
            <input
              type="date"
              value={localFilters.dateFrom ? localFilters.dateFrom.split('T')[0] : ''}
              onChange={handleDateFromChange}
              min={filterOptions.date_range.min ? filterOptions.date_range.min.split('T')[0] : undefined}
              max={filterOptions.date_range.max ? filterOptions.date_range.max.split('T')[0] : undefined}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Date To Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Created To
            </label>
            <input
              type="date"
              value={localFilters.dateTo ? localFilters.dateTo.split('T')[0] : ''}
              onChange={handleDateToChange}
              min={filterOptions.date_range.min ? filterOptions.date_range.min.split('T')[0] : undefined}
              max={filterOptions.date_range.max ? filterOptions.date_range.max.split('T')[0] : undefined}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
