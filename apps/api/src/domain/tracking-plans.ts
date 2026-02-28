import { randomUUID } from 'node:crypto';
import { Database } from 'bun:sqlite';
import { HttpError, InvalidEventStateError } from '../errors';
import { nowIso } from '../db';
import type {
  EventRow,
  LinkEventPayload,
  TrackingPlanCreatePayload,
  TrackingPlanEventRow,
  TrackingPlanRow,
  TrackingPlanStatus,
  TrackingPlanStatusTransition,
  TrackingPlanUpdatePayload,
} from '../types';

export function createTrackingPlan(
  db: Database,
  payload: TrackingPlanCreatePayload,
): TrackingPlanRow {
  const now = nowIso();

  const result = db
    .query<TrackingPlanRow, [string, string | null, string | null, string | null, string, string]>(
      `INSERT INTO tracking_plans (title, description, prd_content, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       RETURNING *`,
    )
    .get(
      payload.title,
      payload.description ?? null,
      payload.prd_content ?? null,
      payload.created_by ?? null,
      now,
      now,
    );

  if (!result) {
    throw new HttpError(500, 'Failed to create tracking plan');
  }

  return result;
}

export function getTrackingPlan(db: Database, planId: number): TrackingPlanRow | null {
  return db
    .query<TrackingPlanRow, [number]>('SELECT * FROM tracking_plans WHERE id = ?')
    .get(planId) ?? null;
}

export function listTrackingPlans(
  db: Database,
  filters: { status?: TrackingPlanStatus } = {},
): TrackingPlanRow[] {
  let query = 'SELECT * FROM tracking_plans';
  const params: (string | number)[] = [];

  if (filters.status) {
    query += ' WHERE status = ?';
    params.push(filters.status);
  }

  query += ' ORDER BY created_at DESC';

  return db.query<TrackingPlanRow, (string | number)[]>(query).all(...params);
}

export function updateTrackingPlan(
  db: Database,
  planId: number,
  payload: TrackingPlanUpdatePayload,
): TrackingPlanRow {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (payload.title !== undefined) {
    updates.push('title = ?');
    params.push(payload.title);
  }
  if (payload.description !== undefined) {
    updates.push('description = ?');
    params.push(payload.description);
  }
  if (payload.prd_content !== undefined) {
    updates.push('prd_content = ?');
    params.push(payload.prd_content);
  }

  if (updates.length === 0) {
    return plan;
  }

  updates.push('updated_at = ?');
  params.push(nowIso());
  params.push(planId);

  const result = db
    .query<TrackingPlanRow, (string | number | null)[]>(
      `UPDATE tracking_plans SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
    )
    .get(...params);

  if (!result) {
    throw new HttpError(500, 'Failed to update tracking plan');
  }

  return result;
}

export function deleteTrackingPlan(db: Database, planId: number): void {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  if (plan.status !== 'draft') {
    throw new HttpError(
      400,
      `Cannot delete tracking plan in ${plan.status} status. Only draft plans can be deleted.`,
    );
  }

  db.query('DELETE FROM tracking_plans WHERE id = ?').run(planId);
}

export function transitionStatus(
  db: Database,
  planId: number,
  transition: TrackingPlanStatusTransition,
): TrackingPlanRow {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  const currentStatus = plan.status;
  const newStatus = transition.status;

  validateStatusTransition(currentStatus, newStatus);

  const updates: string[] = ['status = ?', 'updated_at = ?'];
  const params: (string | number | null)[] = [newStatus, nowIso()];

  if (newStatus === 'in_review' && !plan.share_token) {
    updates.push('share_token = ?');
    params.push(randomUUID());
  }

  if (newStatus === 'approved') {
    updates.push('approved_at = ?', 'approved_by = ?');
    params.push(nowIso(), transition.changed_by ?? null);

    publishDraftEvents(db, planId);
  }

  if (newStatus === 'archived') {
    updates.push('archived_at = ?', 'archived_by = ?');
    params.push(nowIso(), transition.changed_by ?? null);
  }

  params.push(planId);

  const result = db
    .query<TrackingPlanRow, (string | number | null)[]>(
      `UPDATE tracking_plans SET ${updates.join(', ')} WHERE id = ? RETURNING *`,
    )
    .get(...params);

  if (!result) {
    throw new HttpError(500, 'Failed to transition status');
  }

  return result;
}

function validateStatusTransition(current: TrackingPlanStatus, next: TrackingPlanStatus): void {
  const validTransitions: Record<TrackingPlanStatus, TrackingPlanStatus[]> = {
    draft: ['in_review', 'archived'],
    in_review: ['draft', 'approved', 'archived'],
    approved: ['archived'],
    archived: [],
  };

  if (!validTransitions[current].includes(next)) {
    throw new InvalidEventStateError(
      `Invalid status transition from ${current} to ${next}`,
    );
  }
}

function publishDraftEvents(db: Database, planId: number): void {
  const eventIds = db
    .query<{ event_id: number }, [number]>(
      'SELECT event_id FROM tracking_plan_events WHERE tracking_plan_id = ?',
    )
    .all(planId)
    .map((row) => row.event_id);

  if (eventIds.length === 0) {
    return;
  }

  const placeholders = eventIds.map(() => '?').join(',');
  db.query(
    `UPDATE events SET is_published = 1 WHERE id IN (${placeholders}) AND is_published = 0`,
  ).run(...eventIds);
}

export function linkEvent(
  db: Database,
  planId: number,
  payload: LinkEventPayload,
): void {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  const event = db
    .query<EventRow, [number]>('SELECT * FROM events WHERE id = ?')
    .get(payload.event_id);

  if (!event) {
    throw new HttpError(404, `Event ${payload.event_id} not found`);
  }

  const existing = db
    .query<TrackingPlanEventRow, [number, number]>(
      'SELECT * FROM tracking_plan_events WHERE tracking_plan_id = ? AND event_id = ?',
    )
    .get(planId, payload.event_id);

  if (existing) {
    return;
  }

  const maxPosition = db
    .query<{ max_pos: number | null }, [number]>(
      'SELECT MAX(position) as max_pos FROM tracking_plan_events WHERE tracking_plan_id = ?',
    )
    .get(planId);

  const position = (maxPosition?.max_pos ?? -1) + 1;

  db.query(
    `INSERT INTO tracking_plan_events (tracking_plan_id, event_id, position, added_at, added_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(planId, payload.event_id, position, nowIso(), payload.added_by ?? null);
}

export function unlinkEvent(db: Database, planId: number, eventId: number): void {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  db.query(
    'DELETE FROM tracking_plan_events WHERE tracking_plan_id = ? AND event_id = ?',
  ).run(planId, eventId);
}

export function reorderEvents(
  db: Database,
  planId: number,
  eventIds: number[],
): void {
  const plan = getTrackingPlan(db, planId);
  if (!plan) {
    throw new HttpError(404, `Tracking plan ${planId} not found`);
  }

  const existingLinks = db
    .query<TrackingPlanEventRow, [number]>(
      'SELECT * FROM tracking_plan_events WHERE tracking_plan_id = ?',
    )
    .all(planId);

  const existingEventIds = new Set(existingLinks.map((link) => link.event_id));
  const providedEventIds = new Set(eventIds);

  if (existingEventIds.size !== providedEventIds.size ||
      ![...existingEventIds].every((id) => providedEventIds.has(id))) {
    throw new HttpError(
      400,
      'event_ids must contain all events currently in the tracking plan',
    );
  }

  const updateStmt = db.prepare(
    'UPDATE tracking_plan_events SET position = ? WHERE tracking_plan_id = ? AND event_id = ?',
  );

  eventIds.forEach((eventId, index) => {
    updateStmt.run(index, planId, eventId);
  });
}

export function getTrackingPlanEvents(db: Database, planId: number): EventRow[] {
  return db
    .query<EventRow, [number]>(
      `SELECT e.*
       FROM events e
       JOIN tracking_plan_events tpe ON e.id = tpe.event_id
       WHERE tpe.tracking_plan_id = ?
       ORDER BY tpe.position ASC`,
    )
    .all(planId);
}
