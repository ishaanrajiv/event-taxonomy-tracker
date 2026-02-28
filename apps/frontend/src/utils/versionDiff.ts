import type { EventVersionDetail, EventWriteProperty } from '../types/api';

type VersionDiff = EventVersionDetail['diff'];

export interface ParsedMetadataChange {
  field: keyof VersionDiff['metadata'] | string;
  label: string;
  from: string;
  to: string;
  summary: string;
}

export interface ParsedPropertyFieldChange {
  field: string;
  label: string;
  from: string;
  to: string;
}

export interface ParsedPropertyChange {
  key: string;
  kind: 'added' | 'removed' | 'updated';
  name: string;
  descriptor: string;
  summary: string;
  fieldChanges: ParsedPropertyFieldChange[];
}

const METADATA_LABELS: Record<string, string> = {
  name: 'Event name',
  description: 'Description',
  category: 'Category',
  is_archived: 'Status',
};

const PROPERTY_FIELD_LABELS: Record<string, string> = {
  property_name: 'Name',
  property_type: 'Scope',
  data_type: 'Type',
  is_required: 'Required',
  example_value: 'Example',
  description: 'Description',
};

const EMPTY_VALUE = 'Empty';

const toTitleCase = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

export const formatDiffValue = (field: string, value: unknown): string => {
  if (field === 'is_archived') {
    return value ? 'Archived' : 'Active';
  }

  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

export const getMetadataLabel = (field: string): string => METADATA_LABELS[field] ?? toTitleCase(field);

const getMetadataSummary = (field: string, from: unknown, to: unknown): string => {
  const label = getMetadataLabel(field);
  const formattedFrom = formatDiffValue(field, from);
  const formattedTo = formatDiffValue(field, to);

  if (from === null || from === undefined || from === '') {
    return `${label} set to ${formattedTo}`;
  }

  if (to === null || to === undefined || to === '') {
    return `${label} cleared`;
  }

  return `${label} changed from ${formattedFrom} to ${formattedTo}`;
};

export const parseMetadataChanges = (diff: VersionDiff): ParsedMetadataChange[] =>
  Object.entries(diff.metadata).map(([field, change]) => ({
    field,
    label: getMetadataLabel(field),
    from: formatDiffValue(field, change.from),
    to: formatDiffValue(field, change.to),
    summary: getMetadataSummary(field, change.from, change.to),
  }));

const getPropertyDescriptor = (property: EventWriteProperty): string => {
  const requiredLabel = property.is_required ? 'required' : 'optional';
  return `${property.property_type} · ${property.data_type} · ${requiredLabel}`;
};

const getPropertyChangeLabel = (field: string): string => PROPERTY_FIELD_LABELS[field] ?? toTitleCase(field);

const parsePropertyFieldChanges = (
  before: EventWriteProperty,
  after: EventWriteProperty
): ParsedPropertyFieldChange[] =>
  (Object.keys(PROPERTY_FIELD_LABELS) as Array<keyof EventWriteProperty>)
    .filter((field) => before[field] !== after[field])
    .map((field) => ({
      field,
      label: getPropertyChangeLabel(field),
      from: formatDiffValue(field, before[field]),
      to: formatDiffValue(field, after[field]),
    }));

export const parsePropertyChanges = (diff: VersionDiff): ParsedPropertyChange[] => [
  ...diff.properties.added.map((property) => ({
    key: `added:${property.property_name}:${property.property_type}`,
    kind: 'added' as const,
    name: property.property_name,
    descriptor: getPropertyDescriptor(property),
    summary: `Added ${property.property_name}`,
    fieldChanges: [],
  })),
  ...diff.properties.removed.map((property) => ({
    key: `removed:${property.property_name}:${property.property_type}`,
    kind: 'removed' as const,
    name: property.property_name,
    descriptor: getPropertyDescriptor(property),
    summary: `Removed ${property.property_name}`,
    fieldChanges: [],
  })),
  ...diff.properties.updated.map((property) => {
    const fieldChanges = parsePropertyFieldChanges(property.before, property.after);
    return {
      key: `updated:${property.key}`,
      kind: 'updated' as const,
      name: property.after.property_name,
      descriptor: getPropertyDescriptor(property.after),
      summary: `Updated ${property.after.property_name}`,
      fieldChanges,
    };
  }),
];

export const countVersionDiffs = (diff: VersionDiff) => ({
  metadata: Object.keys(diff.metadata).length,
  added: diff.properties.added.length,
  removed: diff.properties.removed.length,
  updated: diff.properties.updated.length,
});

export const describeProperty = (property: EventWriteProperty): string => getPropertyDescriptor(property);
