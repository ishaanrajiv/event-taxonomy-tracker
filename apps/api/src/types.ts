export type PropertyDataType =
  | 'String'
  | 'Int'
  | 'Float'
  | 'Boolean'
  | 'List'
  | 'JSON';

export type PropertyType = 'event' | 'user' | 'super';

export type VersionAction = 'create' | 'update' | 'archive' | 'restore' | 'revert';

export interface EventWriteProperty {
  property_name: string;
  property_type: PropertyType;
  data_type: PropertyDataType;
  is_required: boolean;
  example_value?: string | null;
  description?: string | null;
}

export interface EventCreatePayload {
  name: string;
  description?: string | null;
  category?: string | null;
  created_by?: string | null;
  change_reason?: string | null;
  properties: EventWriteProperty[];
  is_published?: 0 | 1;
}

export interface EventUpdatePayload {
  name: string;
  description?: string | null;
  category?: string | null;
  base_version_number: number;
  changed_by?: string | null;
  change_reason?: string | null;
  properties: EventWriteProperty[];
}

export interface EventArchivePayload {
  base_version_number: number;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface EventRevertPayload {
  base_version_number: number;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface NormalizedProperty {
  property_name: string;
  property_type: PropertyType;
  data_type: PropertyDataType;
  is_required: boolean;
  example_value: string | null;
  description: string | null;
}

export interface EventSnapshot {
  event: {
    name: string;
    description: string | null;
    category: string | null;
    is_archived: boolean;
  };
  properties: NormalizedProperty[];
}

export interface EventDiff {
  metadata: Record<string, { from: unknown; to: unknown }>;
  properties: {
    added: NormalizedProperty[];
    removed: NormalizedProperty[];
    updated: Array<{
      key: string;
      before: NormalizedProperty;
      after: NormalizedProperty;
    }>;
  };
}

export interface EventRow {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  current_version_number: number;
  current_version_id: number | null;
  is_archived: number;
  archived_at: string | null;
  archived_by: string | null;
  lock_version: number;
  is_published: number;
}

export interface EventPropertyRow {
  id: number;
  event_id: number;
  property_id: number;
  property_name: string;
  property_type: PropertyType;
  data_type: string;
  description: string | null;
  is_required: number;
  example_value: string | null;
}

export interface EventVersionRow {
  id: number;
  event_id: number;
  version_number: number;
  parent_version_id: number | null;
  action: VersionAction;
  summary: string;
  change_reason: string | null;
  snapshot: string;
  diff: string;
  checksum: string;
  created_by: string | null;
  created_at: string;
  reverted_from_version_id: number | null;
}

export interface PropertyRow {
  id: number;
  name: string;
  data_type: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
}

export interface SearchEventRow {
  id: number;
  name: string;
}

export type TrackingPlanStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export interface TrackingPlanRow {
  id: number;
  title: string;
  description: string | null;
  prd_content: string | null;
  status: TrackingPlanStatus;
  share_token: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  archived_at: string | null;
  archived_by: string | null;
}

export interface TrackingPlanEventRow {
  id: number;
  tracking_plan_id: number;
  event_id: number;
  position: number;
  added_at: string;
  added_by: string | null;
}

export interface TrackingPlanCreatePayload {
  title: string;
  description?: string | null;
  prd_content?: string | null;
  created_by?: string | null;
}

export interface TrackingPlanUpdatePayload {
  title?: string;
  description?: string | null;
  prd_content?: string | null;
}

export interface TrackingPlanStatusTransition {
  status: 'in_review' | 'approved' | 'draft' | 'archived';
  changed_by?: string | null;
}

export interface LinkEventPayload {
  event_id: number;
  added_by?: string | null;
}

export interface ReorderEventsPayload {
  event_ids: number[];
}
