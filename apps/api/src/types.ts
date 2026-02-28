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
