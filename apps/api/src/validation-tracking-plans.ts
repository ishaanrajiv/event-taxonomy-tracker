import { HttpError } from './errors';
import type {
  LinkEventPayload,
  ReorderEventsPayload,
  TrackingPlanCreatePayload,
  TrackingPlanStatus,
  TrackingPlanStatusTransition,
  TrackingPlanUpdatePayload,
} from './types';

const VALID_STATUSES = new Set<TrackingPlanStatus>(['draft', 'in_review', 'approved', 'archived']);

export function parseTrackingPlanCreatePayload(payload: unknown): TrackingPlanCreatePayload {
  const data = asRecord(payload);

  return {
    title: normalizeNonEmptyString(data.title, 'title'),
    description: normalizeNullableString(data.description),
    prd_content: normalizeNullableString(data.prd_content),
    created_by: normalizeNullableString(data.created_by),
  };
}

export function parseTrackingPlanUpdatePayload(payload: unknown): TrackingPlanUpdatePayload {
  const data = asRecord(payload);

  const update: TrackingPlanUpdatePayload = {};

  if (data.title !== undefined) {
    update.title = normalizeNonEmptyString(data.title, 'title');
  }
  if (data.description !== undefined) {
    update.description = normalizeNullableString(data.description);
  }
  if (data.prd_content !== undefined) {
    update.prd_content = normalizeNullableString(data.prd_content);
  }

  return update;
}

export function parseStatusTransition(payload: unknown): TrackingPlanStatusTransition {
  const data = asRecord(payload);

  const status = normalizeNonEmptyString(data.status, 'status');
  if (!VALID_STATUSES.has(status as TrackingPlanStatus)) {
    throw new HttpError(
      400,
      `Invalid status: ${status}. Must be one of: draft, in_review, approved, archived`,
    );
  }

  return {
    status: status as TrackingPlanStatus,
    changed_by: normalizeNullableString(data.changed_by),
  };
}

export function parseLinkEventPayload(payload: unknown): LinkEventPayload {
  const data = asRecord(payload);

  return {
    event_id: parsePositiveInteger(data.event_id, 'event_id', 1),
    added_by: normalizeNullableString(data.added_by),
  };
}

export function parseReorderEventsPayload(payload: unknown): ReorderEventsPayload {
  const data = asRecord(payload);

  if (!Array.isArray(data.event_ids)) {
    throw new HttpError(400, 'event_ids must be an array');
  }

  const event_ids = data.event_ids.map((id, index) => {
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
      throw new HttpError(400, `event_ids[${index}] must be a positive integer`);
    }
    return id;
  });

  return { event_ids };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HttpError(400, 'Payload must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function normalizeNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new HttpError(400, `${field} cannot be empty`);
  }
  return trimmed;
}

function normalizeNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'Value must be a string or null');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePositiveInteger(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new HttpError(400, `${field} must be an integer >= ${min}`);
  }
  return value;
}
