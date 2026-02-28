import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { validationCodes, type PublishFeatureRequest, type UpsertCatalogEventRequest } from '@tracker/contracts'

import { db } from '../db/client.js'
import {
  catalogEventProperties,
  catalogEvents,
  catalogEventVersions,
  catalogProperties,
  features,
  planEventProperties,
  planEvents,
  trackingPlanReleases,
  trackingPlans,
  validationIssues,
} from '../db/schema.js'
import { makeId } from '../lib/id.js'
import { safeParseJson, serializeJson } from '../lib/json.js'
import { normalizeName } from '../lib/strings.js'
import { nowIso } from '../lib/time.js'
import { recomputeValidationForFeature } from './validation-engine.js'

type PublishResult = {
  releaseId: string
  releaseNumber: number
  created: number
  updated: number
  reused: number
}

const serializeCatalogEvent = (event: typeof catalogEvents.$inferSelect) => ({
  id: event.id,
  name: event.name,
  description: event.description,
  trigger: event.trigger,
  platforms: safeParseJson<string[]>(event.platformsJson, []),
  status: event.status,
  currentVersionNumber: event.currentVersionNumber,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt,
})

const writeCatalogVersion = async (
  tx: typeof db,
  params: {
    event: typeof catalogEvents.$inferSelect
    action: 'create' | 'update'
    sourceFeatureId: string | null
    sourceReleaseId: string | null
    previousSnapshot: unknown | null
  },
): Promise<void> => {
  const snapshot = serializeCatalogEvent(params.event)
  const diff = {
    previous: params.previousSnapshot,
    current: snapshot,
  }

  await tx.insert(catalogEventVersions).values({
    id: makeId(),
    catalogEventId: params.event.id,
    versionNumber: params.event.currentVersionNumber,
    action: params.action,
    snapshotJson: serializeJson(snapshot),
    diffJson: serializeJson(diff),
    sourceFeatureId: params.sourceFeatureId,
    sourceReleaseId: params.sourceReleaseId,
    createdAt: nowIso(),
  })
}

const upsertProperty = async (
  tx: typeof db,
  input: {
    name: string
    dataType: string
    description?: string | null
    allowedValuesJson?: unknown
  },
): Promise<typeof catalogProperties.$inferSelect> => {
  const normalizedName = normalizeName(input.name)
  const [typeConflict] = await tx
    .select()
    .from(catalogProperties)
    .where(and(eq(catalogProperties.normalizedName, normalizedName), ne(catalogProperties.dataType, input.dataType)))
    .limit(1)

  if (typeConflict) {
    const error = new Error(`Property ${input.name} already exists with data type ${typeConflict.dataType}`)
    ;(error as Error & { statusCode?: number }).statusCode = 409
    throw error
  }

  const [existing] = await tx
    .select()
    .from(catalogProperties)
    .where(and(eq(catalogProperties.normalizedName, normalizedName), eq(catalogProperties.dataType, input.dataType)))
    .limit(1)

  if (existing) {
    const nextDescription = input.description ?? existing.description
    const nextAllowed = input.allowedValuesJson ? serializeJson(input.allowedValuesJson) : existing.allowedValuesJson

    await tx
      .update(catalogProperties)
      .set({
        name: input.name,
        description: nextDescription,
        allowedValuesJson: nextAllowed,
        updatedAt: nowIso(),
      })
      .where(eq(catalogProperties.id, existing.id))

    const [updated] = await tx.select().from(catalogProperties).where(eq(catalogProperties.id, existing.id)).limit(1)
    return updated
  }

  const id = makeId()
  await tx.insert(catalogProperties).values({
    id,
    name: input.name,
    normalizedName,
    dataType: input.dataType,
    description: input.description ?? null,
    allowedValuesJson: input.allowedValuesJson ? serializeJson(input.allowedValuesJson) : null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  })

  const [created] = await tx.select().from(catalogProperties).where(eq(catalogProperties.id, id)).limit(1)
  return created
}

const replaceCatalogEventProperties = async (
  tx: typeof db,
  eventId: string,
  properties: Array<{
    name: string
    dataType: string
    description?: string | null
    scope: string
    required: boolean
    exampleValue?: string | null
    allowedValuesJson?: unknown
  }>,
): Promise<void> => {
  await tx.delete(catalogEventProperties).where(eq(catalogEventProperties.catalogEventId, eventId))

  for (const property of properties) {
    const registryProperty = await upsertProperty(tx, {
      name: property.name,
      dataType: property.dataType,
      description: property.description,
      allowedValuesJson: property.allowedValuesJson,
    })

    await tx.insert(catalogEventProperties).values({
      id: makeId(),
      catalogEventId: eventId,
      propertyId: registryProperty.id,
      scope: property.scope,
      required: property.required,
      exampleValue: property.exampleValue ?? null,
      notes: null,
    })
  }
}

export const publishTrackingPlan = async (
  featureId: string,
  payload: PublishFeatureRequest,
): Promise<PublishResult> => {
  const validation = await recomputeValidationForFeature(featureId)
  const blockers = validation.issues.filter((issue) => issue.severity === 'blocker')
  const warnings = validation.issues.filter((issue) => issue.severity === 'warning')

  if (blockers.length > 0) {
    const error = new Error('Blocker validations remain')
    ;(error as Error & { statusCode?: number; issues?: unknown }).statusCode = 409
    ;(error as Error & { issues?: unknown }).issues = blockers
    throw error
  }

  if (warnings.length > 0 && !payload.warningAcknowledgement?.trim()) {
    const error = new Error('Warning acknowledgement is required to publish with warnings')
    ;(error as Error & { statusCode?: number; issues?: unknown }).statusCode = 409
    ;(error as Error & { issues?: unknown }).issues = warnings
    throw error
  }

  return db.transaction(async (tx) => {
    const [feature] = await tx.select().from(features).where(eq(features.id, featureId)).limit(1)
    if (!feature) {
      throw new Error('Feature not found')
    }

    const [plan] = await tx.select().from(trackingPlans).where(eq(trackingPlans.featureId, featureId)).limit(1)
    if (!plan) {
      throw new Error('Tracking plan not found')
    }

    const eventRows = await tx.select().from(planEvents).where(eq(planEvents.trackingPlanId, plan.id))
    const eventIds = eventRows.map((event) => event.id)
    const propertyRows = eventIds.length
      ? await tx.select().from(planEventProperties).where(inArray(planEventProperties.planEventId, eventIds))
      : []

    let createdCount = 0
    let updatedCount = 0
    let reusedCount = 0

    const staleIssues: Array<typeof validationIssues.$inferInsert> = []
    for (const event of eventRows) {
      if (event.decisionType !== 'update' || !event.linkedCatalogEventId) {
        continue
      }

      const [catalogEvent] = await tx
        .select()
        .from(catalogEvents)
        .where(eq(catalogEvents.id, event.linkedCatalogEventId))
        .limit(1)

      if (!catalogEvent || catalogEvent.currentVersionNumber !== (event.catalogBaseVersionNumber ?? -1)) {
        staleIssues.push({
          id: makeId(),
          featureId,
          trackingPlanId: plan.id,
          entityType: 'plan_event',
          entityId: event.id,
          severity: 'blocker',
          code: validationCodes.publish_conflict_catalog_version_changed,
          title: 'Catalog version changed',
          message: `Catalog event changed since this plan event was synced: ${event.name ?? event.id}`,
          source: 'rule',
          isDismissed: false,
          dismissedReason: null,
          createdAt: nowIso(),
        })
      }
    }

    if (staleIssues.length > 0) {
      await tx.insert(validationIssues).values(staleIssues)
      const error = new Error('Catalog conflicts detected')
      ;(error as Error & { statusCode?: number; issues?: unknown }).statusCode = 409
      ;(error as Error & { issues?: unknown }).issues = staleIssues
      throw error
    }

    const maxReleaseRow = await tx
      .select({ maxRelease: sql<number>`coalesce(max(${trackingPlanReleases.releaseNumber}), 0)` })
      .from(trackingPlanReleases)
      .where(eq(trackingPlanReleases.featureId, featureId))

    const releaseNumber = (maxReleaseRow[0]?.maxRelease ?? 0) + 1
    const releaseId = makeId()

    for (const event of eventRows.sort((a, b) => a.ordinal - b.ordinal)) {
      const eventProperties = propertyRows
        .filter((property) => property.planEventId === event.id)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((property) => ({
          name: property.name,
          dataType: property.dataType,
          description: property.description,
          scope: property.scope,
          required: property.required,
          exampleValue: property.exampleValue,
          allowedValuesJson: property.allowedValuesJson ? safeParseJson(property.allowedValuesJson, null) : null,
        }))

      if (event.decisionType === 'reuse' && event.linkedCatalogEventId) {
        reusedCount += 1
      } else if (event.decisionType === 'update' && event.linkedCatalogEventId) {
        const [currentEvent] = await tx
          .select()
          .from(catalogEvents)
          .where(eq(catalogEvents.id, event.linkedCatalogEventId))
          .limit(1)

        if (!currentEvent) {
          throw new Error(`Catalog event not found: ${event.linkedCatalogEventId}`)
        }

        const previousSnapshot = serializeCatalogEvent(currentEvent)
        const nextVersion = currentEvent.currentVersionNumber + 1

        await tx
          .update(catalogEvents)
          .set({
            name: event.name ?? currentEvent.name,
            description: event.description ?? currentEvent.description,
            trigger: event.trigger ?? currentEvent.trigger,
            platformsJson: event.platformsJson,
            updatedAt: nowIso(),
            currentVersionNumber: nextVersion,
          })
          .where(eq(catalogEvents.id, currentEvent.id))

        await replaceCatalogEventProperties(tx, currentEvent.id, eventProperties)

        const [updated] = await tx.select().from(catalogEvents).where(eq(catalogEvents.id, currentEvent.id)).limit(1)
        await writeCatalogVersion(tx, {
          event: updated,
          action: 'update',
          sourceFeatureId: featureId,
          sourceReleaseId: releaseId,
          previousSnapshot,
        })
        updatedCount += 1
      } else {
        const catalogEventId = makeId()
        await tx.insert(catalogEvents).values({
          id: catalogEventId,
          name: event.name ?? `unnamed_event_${event.id.slice(0, 8)}`,
          description: event.description,
          trigger: event.trigger,
          platformsJson: event.platformsJson,
          status: 'active',
          currentVersionNumber: 1,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        })

        await replaceCatalogEventProperties(tx, catalogEventId, eventProperties)

        const [created] = await tx.select().from(catalogEvents).where(eq(catalogEvents.id, catalogEventId)).limit(1)
        await writeCatalogVersion(tx, {
          event: created,
          action: 'create',
          sourceFeatureId: featureId,
          sourceReleaseId: releaseId,
          previousSnapshot: null,
        })

        await tx
          .update(planEvents)
          .set({ linkedCatalogEventId: catalogEventId, catalogBaseVersionNumber: 1 })
          .where(eq(planEvents.id, event.id))

        createdCount += 1
      }

      await tx
        .update(planEvents)
        .set({ workflowState: 'published', updatedAt: nowIso() })
        .where(eq(planEvents.id, event.id))
    }

    await tx.insert(trackingPlanReleases).values({
      id: releaseId,
      featureId,
      trackingPlanId: plan.id,
      releaseNumber,
      summary: payload.summary ?? null,
      publishedBy: payload.actorName,
      publishedAt: nowIso(),
      resultSnapshotJson: serializeJson({ createdCount, updatedCount, reusedCount }),
      resultDiffJson: serializeJson({
        groups: {
          create: createdCount,
          update: updatedCount,
          reuse: reusedCount,
        },
        warningAcknowledgement: payload.warningAcknowledgement ?? null,
      }),
      publishMode: 'tracking_plan',
    })

    await tx
      .update(features)
      .set({
        hasUnpublishedChanges: false,
        lastPublishedReleaseNumber: releaseNumber,
        updatedAt: nowIso(),
      })
      .where(eq(features.id, featureId))

    return {
      releaseId,
      releaseNumber,
      created: createdCount,
      updated: updatedCount,
      reused: reusedCount,
    }
  })
}

export const publishAdhocCatalogEvent = async (
  payload: UpsertCatalogEventRequest,
  existingEventId?: string,
): Promise<{ releaseId: string; eventId: string }> => {
  return db.transaction(async (tx) => {
    let eventId: string
    let action: 'create' | 'update'
    let previousSnapshot: unknown = null

    if (existingEventId) {
      const [existing] = await tx.select().from(catalogEvents).where(eq(catalogEvents.id, existingEventId)).limit(1)
      if (!existing) {
        throw new Error('Catalog event not found for update')
      }

      if (payload.baseVersionNumber !== undefined && existing.currentVersionNumber !== payload.baseVersionNumber) {
        const error = new Error('Version conflict for ad hoc update')
        ;(error as Error & { statusCode?: number }).statusCode = 409
        throw error
      }

      previousSnapshot = serializeCatalogEvent(existing)
      eventId = existing.id
      action = 'update'

      await tx
        .update(catalogEvents)
        .set({
          name: payload.name,
          description: payload.description ?? null,
          trigger: payload.trigger ?? null,
          platformsJson: serializeJson(payload.platforms),
          status: payload.status,
          currentVersionNumber: existing.currentVersionNumber + 1,
          updatedAt: nowIso(),
        })
        .where(eq(catalogEvents.id, eventId))
    } else {
      eventId = makeId()
      action = 'create'
      await tx.insert(catalogEvents).values({
        id: eventId,
        name: payload.name,
        description: payload.description ?? null,
        trigger: payload.trigger ?? null,
        platformsJson: serializeJson(payload.platforms),
        status: payload.status,
        currentVersionNumber: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      })
    }

    await replaceCatalogEventProperties(
      tx,
      eventId,
      payload.properties.map((property) => ({
        name: property.name,
        dataType: property.dataType,
        description: property.description,
        scope: property.scope,
        required: property.required,
        exampleValue: property.exampleValue,
        allowedValuesJson: property.allowedValuesJson,
      })),
    )

    const [event] = await tx.select().from(catalogEvents).where(eq(catalogEvents.id, eventId)).limit(1)

    const releaseId = makeId()
    const maxReleaseRow = await tx.select({ maxRelease: sql<number>`coalesce(max(${trackingPlanReleases.releaseNumber}), 0)` }).from(
      trackingPlanReleases,
    )
    const releaseNumber = (maxReleaseRow[0]?.maxRelease ?? 0) + 1

    await tx.insert(trackingPlanReleases).values({
      id: releaseId,
      featureId: payload.featureId ?? null,
      trackingPlanId: null,
      releaseNumber,
      summary: `Ad hoc publish: ${payload.name}`,
      publishedBy: payload.actorName,
      publishedAt: nowIso(),
      resultSnapshotJson: serializeJson({ eventId }),
      resultDiffJson: serializeJson({ action }),
      publishMode: 'adhoc',
    })

    await writeCatalogVersion(tx, {
      event,
      action,
      sourceFeatureId: payload.featureId ?? null,
      sourceReleaseId: releaseId,
      previousSnapshot,
    })

    return { releaseId, eventId }
  })
}
