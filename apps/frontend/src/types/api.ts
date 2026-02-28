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

export interface EventWriteProperty {
  property_name: string;
  property_type: 'event' | 'user' | 'super';
  data_type: string;
  is_required: boolean;
  example_value?: string | null;
  description?: string | null;
}

export interface EventProperty extends EventWriteProperty {
  id: number;
  property_id?: number | null;
}

export interface EventBase {
  name: string;
  description?: string | null;
  category?: string | null;
}

export interface EventCreate extends EventBase {
  created_by?: string | null;
  change_reason?: string | null;
  properties?: EventWriteProperty[];
}

export interface EventUpsertRequest extends EventBase {
  base_version_number: number;
  changed_by?: string | null;
  change_reason?: string | null;
  properties: EventWriteProperty[];
}

export interface RevertEventRequest {
  base_version_number: number;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface Event extends EventBase {
  id: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  version_number: number;
  is_archived: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  lock_version: number;
  properties: EventProperty[];
}

export interface EventVersionSummary {
  id: number;
  event_id: number;
  event_name: string;
  version_number: number;
  action: 'create' | 'update' | 'archive' | 'restore' | 'revert';
  summary: string;
  change_reason?: string | null;
  created_by?: string | null;
  created_at: string;
  parent_version_number?: number | null;
  reverted_from_version_number?: number | null;
  is_current: boolean;
}

export interface EventVersionDetail extends EventVersionSummary {
  checksum: string;
  snapshot: {
    event: {
      name: string;
      description?: string | null;
      category?: string | null;
      is_archived: boolean;
    };
    properties: EventWriteProperty[];
  };
  diff: {
    metadata: Record<string, { from: unknown; to: unknown }>;
    properties: {
      added: EventWriteProperty[];
      removed: EventWriteProperty[];
      updated: Array<{
        key: string;
        before: EventWriteProperty;
        after: EventWriteProperty;
      }>;
    };
  };
}

export interface ChangelogEntry {
  id: number;
  entity_type: 'event';
  entity_id: number;
  event_name: string;
  version_number: number;
  action: 'create' | 'update' | 'archive' | 'restore' | 'revert';
  summary: string;
  change_reason?: string | null;
  diff: EventVersionDetail['diff'];
  snapshot: EventVersionDetail['snapshot'];
  changed_by?: string | null;
  changed_at: string;
  is_current: boolean;
}

export interface PropertySuggestion {
  name: string;
  data_type: string;
  similarity: number;
}

export interface FeatureCategory {
  name: string;
  description: string;
}

export interface FeaturesResponse {
  [category: string]: FeatureCategory;
}

export type EventsResponse = Event[];
export type PropertiesResponse = Property[];
export type ChangelogResponse = ChangelogEntry[];
export type PropertySuggestionsResponse = PropertySuggestion[];

export interface APIError {
  detail: string;
}

export interface BulkImportResponse {
  imported: number;
  total: number;
  errors?: string[];
}

export interface EventsQueryParams {
  q?: string;
  category?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  sort_order?: 'asc' | 'desc';
  include_archived?: boolean;
  only_archived?: boolean;
}

export interface PropertySuggestionsParams {
  name: string;
}

export interface FilterOptions {
  categories: string[];
  creators: string[];
  date_range: {
    min: string | null;
    max: string | null;
  };
}

export interface ActiveFilters {
  category?: string;
  creator?: string;
  dateFrom?: string;
  dateTo?: string;
  archivedState?: 'active' | 'all' | 'archived';
}

export type TrackingPlanStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface TrackingPlanBase {
  title: string;
  description?: string | null;
  prd_content?: string | null;
}

export interface TrackingPlanCreate extends TrackingPlanBase {
  created_by?: string | null;
}

export interface TrackingPlanUpdate {
  title?: string;
  description?: string | null;
  prd_content?: string | null;
}

export interface TrackingPlanSummary extends TrackingPlanBase {
  id: number;
  status: TrackingPlanStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  event_count: number;
}

export interface TrackingPlan extends TrackingPlanBase {
  id: number;
  status: TrackingPlanStatus;
  share_token?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  approved_at?: string | null;
  approved_by?: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  events: Event[];
}

export interface StatusTransition {
  status: TrackingPlanStatus;
  changed_by?: string | null;
}

export interface LinkEventRequest {
  event_id: number;
  added_by?: string | null;
}

export interface ReorderEventsRequest {
  event_ids: number[];
}
