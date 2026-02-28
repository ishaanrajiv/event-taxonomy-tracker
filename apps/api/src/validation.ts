import { HttpError } from './errors';
import type {
  EventArchivePayload,
  EventCreatePayload,
  EventRevertPayload,
  EventUpdatePayload,
  EventWriteProperty,
  PropertyDataType,
  PropertyType,
} from './types';

const PROPERTY_TYPES = new Set<PropertyType>(['event', 'user', 'super']);
const DATA_TYPES = new Set<PropertyDataType>(['String', 'Int', 'Float', 'Boolean', 'List', 'JSON']);

export function parseEventCreatePayload(payload: unknown): EventCreatePayload {
  const data = asRecord(payload);

  return {
    name: normalizeNonEmptyString(data.name, 'name'),
    description: normalizeNullableString(data.description),
    category: normalizeNullableString(data.category),
    created_by: normalizeNullableString(data.created_by),
    change_reason: normalizeNullableString(data.change_reason),
    properties: parseProperties(data.properties, true),
  };
}

export function parseEventUpdatePayload(payload: unknown): EventUpdatePayload {
  const data = asRecord(payload);

  return {
    name: normalizeNonEmptyString(data.name, 'name'),
    description: normalizeNullableString(data.description),
    category: normalizeNullableString(data.category),
    base_version_number: parsePositiveInteger(data.base_version_number, 'base_version_number', 1),
    changed_by: normalizeNullableString(data.changed_by),
    change_reason: normalizeNullableString(data.change_reason),
    properties: parseProperties(data.properties, true),
  };
}

export function parseEventArchivePayload(payload: unknown): EventArchivePayload {
  const data = asRecord(payload);
  return {
    base_version_number: parsePositiveInteger(data.base_version_number, 'base_version_number', 1),
    changed_by: normalizeNullableString(data.changed_by),
    change_reason: normalizeNullableString(data.change_reason),
  };
}

export function parseEventRevertPayload(payload: unknown): EventRevertPayload {
  const data = asRecord(payload);
  return {
    base_version_number: parsePositiveInteger(data.base_version_number, 'base_version_number', 1),
    changed_by: normalizeNullableString(data.changed_by),
    change_reason: normalizeNullableString(data.change_reason),
  };
}

export function parsePropertyCreatePayload(payload: unknown): {
  name: string;
  data_type: PropertyDataType;
  description: string | null;
  created_by: string | null;
} {
  const data = asRecord(payload);
  const dataType = normalizeNonEmptyString(data.data_type, 'data_type') as PropertyDataType;
  if (!DATA_TYPES.has(dataType)) {
    throw new HttpError(400, 'Invalid data_type');
  }

  return {
    name: normalizeNonEmptyString(data.name, 'name'),
    data_type: dataType,
    description: normalizeNullableString(data.description),
    created_by: normalizeNullableString(data.created_by),
  };
}

function parseProperties(value: unknown, defaultEmpty: boolean): EventWriteProperty[] {
  if (value == null && defaultEmpty) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, 'properties must be an array');
  }

  return value.map((item) => parseProperty(item));
}

function parseProperty(value: unknown): EventWriteProperty {
  const data = asRecord(value);
  const propertyType = normalizeNonEmptyString(data.property_type, 'property_type') as PropertyType;
  const dataType = normalizeNonEmptyString(data.data_type, 'data_type') as PropertyDataType;

  if (!PROPERTY_TYPES.has(propertyType)) {
    throw new HttpError(400, 'Invalid property_type');
  }
  if (!DATA_TYPES.has(dataType)) {
    throw new HttpError(400, 'Invalid data_type');
  }

  const propertyName = normalizeNonEmptyString(data.property_name, 'property_name');

  return {
    property_name: propertyName,
    property_type: propertyType,
    data_type: dataType,
    is_required: Boolean(data.is_required ?? false),
    example_value: normalizeNullableString(data.example_value),
    description: normalizeNullableString(data.description),
  };
}

function normalizeNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new HttpError(400, `${field} must not be empty`);
  }
  return normalized;
}

function normalizeNullableString(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new HttpError(400, 'Expected a string');
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parsePositiveInteger(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new HttpError(400, `${field} must be an integer >= ${min}`);
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  return value as Record<string, unknown>;
}
