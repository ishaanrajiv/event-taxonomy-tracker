// TypeScript types matching backend Pydantic models

// Property types
export interface PropertyBase {
  name: string;
  data_type: string;
  description?: string | null;
  created_by?: string | null;
}

export interface Property extends PropertyBase {
  id: number;
  created_at: string;
}

export type PropertyCreate = PropertyBase;

// Event Property types
export interface EventPropertyBase {
  property_id: number;
  property_type: 'event' | 'user' | 'super';
  is_required: boolean;
  example_value?: string | null;
}

export interface EventPropertyCreate {
  property_name: string;
  property_type: 'event' | 'user' | 'super';
  data_type: string;
  is_required: boolean;
  example_value?: string | null;
  description?: string | null;
}

export interface EventProperty extends EventPropertyBase {
  id: number;
  property_name: string;
  data_type: string;
  description?: string | null;
}

// Event types
export interface EventBase {
  name: string;
  description?: string | null;
  category?: string | null;
  created_by?: string | null;
}

export interface EventCreate extends EventBase {
  properties?: EventPropertyCreate[];
}

export interface EventUpdate {
  name?: string;
  description?: string;
  category?: string;
}

export interface Event extends EventBase {
  id: number;
  created_at: string;
  updated_at: string;
  properties: EventProperty[];
}

// Changelog types
export interface ChangelogEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  old_value?: Record<string, any> | null;
  new_value?: Record<string, any> | null;
  changed_by?: string | null;
  changed_at: string;
}

// Property suggestion types
export interface PropertySuggestion {
  name: string;
  data_type: string;
  similarity: number;
}

// Feature categories (for UI)
export interface FeatureCategory {
  name: string;
  description: string;
}

export interface FeaturesResponse {
  [category: string]: FeatureCategory;
}

// API response types
export type EventsResponse = Event[];
export type PropertiesResponse = Property[];
export type ChangelogResponse = ChangelogEntry[];
export type PropertySuggestionsResponse = PropertySuggestion[];

// Error response type
export interface APIError {
  detail: string;
}

// Bulk import types
export interface BulkImportResponse {
  message: string;
  created: number;
  updated: number;
  errors?: string[];
}

// Query parameters
export interface EventsQueryParams {
  q?: string;
  category?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
}

export interface PropertySuggestionsParams {
  name: string;
}

// Filter options
export interface FilterOptions {
  categories: string[];
  creators: string[];
  date_range: {
    min: string | null;
    max: string | null;
  };
}

// Active filters
export interface ActiveFilters {
  category?: string;
  creator?: string;
  dateFrom?: string;
  dateTo?: string;
}
