import { and, desc, eq, inArray, like, sql } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import {
  ApiGetAiRunResponseSchema,
  ApiGetCatalogEventResponseSchema,
  ApiGetFeatureCommentsResponseSchema,
  ApiGetFeatureResponseSchema,
  ApiGetFeatureReleasesResponseSchema,
  ApiGetReleaseResponseSchema,
  ApiGetRequirementsResponseSchema,
  ApiGetSourcesResponseSchema,
  ApiGetTrackingPlanResponseSchema,
  ApiGetValidationResponseSchema,
  ApiListCatalogEventVersionsResponseSchema,
  ApiListCatalogEventsResponseSchema,
  ApiListCatalogPropertiesResponseSchema,
  ApiListFeaturesResponseSchema,
  CreateAiRunRequestSchema,
  CreateCommentRequestSchema,
  CreateFeatureRequestSchema,
  CreatePlanEventRequestSchema,
  CreateRequirementRequestSchema,
  CreateSourceRequestSchema,
  CreateThreadRequestSchema,
  HealthResponseSchema,
  LinkPlanRequirementRequestSchema,
  PublishFeatureRequestSchema,
  ReorderPlanEventsRequestSchema,
  ReorderRequirementsRequestSchema,
  SearchCatalogResponseSchema,
  UpdateFeatureRequestSchema,
  UpdatePlanEventRequestSchema,
  UpdateRequirementRequestSchema,
  UpdateThreadRequestSchema,
  UpdateTrackingPlanRequestSchema,
  UpsertCatalogEventRequestSchema,
} from '@tracker/contracts'

import { db } from '../db/client.js'
import {
  aiRuns,
  catalogEventProperties,
  catalogEvents,
  catalogEventVersions,
  catalogProperties,
  commentThreads,
  comments,
  featureRequirements,
  features,
  featureSources,
  planEventProperties,
  planEventRequirementLinks,
  planEvents,
  trackingPlanReleases,
  trackingPlans,
  validationIssues,
} from '../db/schema.js'
import { makeId } from '../lib/id.js'
import { serializeJson } from '../lib/json.js'
import { toSlug } from '../lib/strings.js'
import { nowIso } from '../lib/time.js'
import {
  mapAiRun,
  mapCatalogEvent,
  mapCatalogEventVersion,
  mapCatalogProperty,
  mapComment,
  mapCommentThread,
  mapFeature,
  mapFeatureRequirement,
  mapFeatureSource,
  mapPlanEvent,
  mapPlanEventProperty,
  mapPlanEventRequirementLink,
  mapTrackingPlan,
  mapTrackingPlanRelease,
  mapValidationIssue,
} from '../services/mappers.js'
import { createAndStartAiRun, isAiEnabled, subscribeAiRun } from '../services/ai-runs.js'
import { extractTextFromBuffer } from '../services/document-parser.js'
import { publishAdhocCatalogEvent, publishTrackingPlan } from '../services/publish.js'
import { buildSourceStoragePath, deleteStoredFile, writeSourceFile } from '../services/storage.js'
import { recomputeValidationForFeature } from '../services/validation-engine.js'

const parseBody = <T>(schema: { parse: (body: unknown) => T }, body: unknown): T => schema.parse(body)

const getFeature = async (featureId: string) => {
  const [feature] = await db.select().from(features).where(eq(features.id, featureId)).limit(1)
  return feature
}

const getTrackingPlanByFeature = async (featureId: string) => {
  const [plan] = await db.select().from(trackingPlans).where(eq(trackingPlans.featureId, featureId)).limit(1)
  return plan
}

const markFeatureDirty = async (featureId: string): Promise<void> => {
  await db
    .update(features)
    .set({ hasUnpublishedChanges: true, updatedAt: nowIso() })
    .where(eq(features.id, featureId))
}

const readMultipartField = (field: unknown): string | undefined => {
  if (!field || typeof field !== 'object') {
    return undefined
  }
  const value = (field as { value?: unknown }).value
  return typeof value === 'string' ? value : undefined
}

export const registerRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get('/api/health', async () => {
    return HealthResponseSchema.parse({
      ok: true,
      version: '3.0.0',
      aiEnabled: isAiEnabled(),
    })
  })

  app.get('/api/features', async () => {
    const rows = await db.select().from(features).orderBy(desc(features.updatedAt))
    return ApiListFeaturesResponseSchema.parse(rows.map(mapFeature))
  })

  app.post('/api/features', async (request, reply) => {
    const body = parseBody(CreateFeatureRequestSchema, request.body)
    const id = makeId()
    const planId = makeId()
    const slug = body.slug ?? toSlug(body.title)

    const existingSlug = await db.select({ id: features.id }).from(features).where(eq(features.slug, slug)).limit(1)
    if (existingSlug.length > 0) {
      return reply.code(409).send({ message: `Feature slug already exists: ${slug}` })
    }

    const timestamp = nowIso()

    await db.transaction(async (tx) => {
      await tx.insert(features).values({
        id,
        slug,
        title: body.title,
        summary: body.summary ?? null,
        productArea: body.productArea ?? null,
        ownerName: body.ownerName ?? null,
        targetRelease: body.targetRelease ?? null,
        workflowStatus: 'draft',
        hasUnpublishedChanges: false,
        lastPublishedReleaseNumber: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      await tx.insert(trackingPlans).values({
        id: planId,
        featureId: id,
        summary: null,
        generationState: 'idle',
        lastGeneratedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })

    const [feature] = await db.select().from(features).where(eq(features.id, id)).limit(1)
    const [plan] = await db.select().from(trackingPlans).where(eq(trackingPlans.featureId, id)).limit(1)

    return reply.code(201).send(ApiGetFeatureResponseSchema.parse({ feature: mapFeature(feature), trackingPlan: mapTrackingPlan(plan) }))
  })

  app.get('/api/features/:featureId', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const feature = await getFeature(featureId)
    if (!feature) {
      return reply.code(404).send({ message: 'Feature not found' })
    }

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    return ApiGetFeatureResponseSchema.parse({
      feature: mapFeature(feature),
      trackingPlan: mapTrackingPlan(plan),
    })
  })

  app.patch('/api/features/:featureId', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(UpdateFeatureRequestSchema, request.body)
    const feature = await getFeature(featureId)
    if (!feature) {
      return reply.code(404).send({ message: 'Feature not found' })
    }

    await db
      .update(features)
      .set({
        ...(body.title ? { title: body.title } : {}),
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.productArea !== undefined ? { productArea: body.productArea } : {}),
        ...(body.ownerName !== undefined ? { ownerName: body.ownerName } : {}),
        ...(body.targetRelease !== undefined ? { targetRelease: body.targetRelease } : {}),
        ...(body.workflowStatus ? { workflowStatus: body.workflowStatus } : {}),
        ...(body.hasUnpublishedChanges !== undefined ? { hasUnpublishedChanges: body.hasUnpublishedChanges } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(features.id, featureId))

    const [updated] = await db.select().from(features).where(eq(features.id, featureId)).limit(1)
    return mapFeature(updated)
  })

  app.get('/api/features/:featureId/sources', async (request) => {
    const { featureId } = request.params as { featureId: string }
    const rows = await db
      .select()
      .from(featureSources)
      .where(eq(featureSources.featureId, featureId))
      .orderBy(desc(featureSources.createdAt))

    return ApiGetSourcesResponseSchema.parse(rows.map(mapFeatureSource))
  })

  app.post('/api/features/:featureId/sources', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const feature = await getFeature(featureId)
    if (!feature) {
      return reply.code(404).send({ message: 'Feature not found' })
    }

    let sourceType = 'pasted_text'
    let title = 'Untitled source'
    let rawText: string | undefined
    let externalUrl: string | undefined
    let originalFilename: string | null = null
    let mimeType: string | null = null
    let storagePath: string | null = null
    let extractedText: string | null = null
    let parseStatus: 'pending' | 'parsed' | 'failed' = 'pending'

    if (request.isMultipart()) {
      const file = await request.file()
      if (!file) {
        return reply.code(400).send({ message: 'No file provided' })
      }

      sourceType = 'uploaded_file'
      title = readMultipartField(file.fields.title) ?? file.filename
      originalFilename = file.filename
      mimeType = file.mimetype

      const sourceId = makeId()
      const buffer = await file.toBuffer()
      const relativePath = buildSourceStoragePath(featureId, sourceId, file.filename)
      writeSourceFile(relativePath, buffer)

      const parsed = await extractTextFromBuffer(mimeType, file.filename, buffer)
      extractedText = parsed.extractedText
      parseStatus = parsed.parseStatus
      storagePath = relativePath

      await db.insert(featureSources).values({
        id: sourceId,
        featureId,
        sourceType,
        title,
        originalFilename,
        mimeType,
        storagePath,
        rawText: null,
        extractedText,
        externalUrl: readMultipartField(file.fields.externalUrl) ?? null,
        parseStatus,
        createdAt: nowIso(),
      })

      await markFeatureDirty(featureId)
      const [created] = await db.select().from(featureSources).where(eq(featureSources.id, sourceId)).limit(1)
      return reply.code(201).send(mapFeatureSource(created))
    }

    const body = parseBody(CreateSourceRequestSchema, request.body)
    sourceType = body.sourceType
    title = body.title
    rawText = body.rawText
    externalUrl = body.externalUrl

    if (sourceType === 'pasted_text' || sourceType === 'note') {
      extractedText = rawText?.trim() ?? null
      parseStatus = extractedText ? 'parsed' : 'failed'
    }

    if (sourceType === 'external_link') {
      parseStatus = 'pending'
    }

    const sourceId = makeId()
    await db.insert(featureSources).values({
      id: sourceId,
      featureId,
      sourceType,
      title,
      originalFilename,
      mimeType,
      storagePath,
      rawText: rawText ?? null,
      extractedText,
      externalUrl: externalUrl ?? null,
      parseStatus,
      createdAt: nowIso(),
    })

    await markFeatureDirty(featureId)
    const [created] = await db.select().from(featureSources).where(eq(featureSources.id, sourceId)).limit(1)
    return reply.code(201).send(mapFeatureSource(created))
  })

  app.delete('/api/features/:featureId/sources/:sourceId', async (request, reply) => {
    const { featureId, sourceId } = request.params as { featureId: string; sourceId: string }
    const [source] = await db
      .select()
      .from(featureSources)
      .where(and(eq(featureSources.id, sourceId), eq(featureSources.featureId, featureId)))
      .limit(1)

    if (!source) {
      return reply.code(404).send({ message: 'Source not found' })
    }

    deleteStoredFile(source.storagePath)
    await db.delete(featureSources).where(eq(featureSources.id, sourceId))
    await markFeatureDirty(featureId)

    return { ok: true }
  })

  app.get('/api/features/:featureId/requirements', async (request) => {
    const { featureId } = request.params as { featureId: string }
    const rows = await db
      .select()
      .from(featureRequirements)
      .where(eq(featureRequirements.featureId, featureId))
      .orderBy(featureRequirements.ordinal)

    return ApiGetRequirementsResponseSchema.parse(rows.map(mapFeatureRequirement))
  })

  app.post('/api/features/:featureId/requirements', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(CreateRequirementRequestSchema, request.body)

    const feature = await getFeature(featureId)
    if (!feature) {
      return reply.code(404).send({ message: 'Feature not found' })
    }

    const maxOrdinalResult = await db
      .select({ maxOrdinal: sql<number>`coalesce(max(${featureRequirements.ordinal}), 0)` })
      .from(featureRequirements)
      .where(eq(featureRequirements.featureId, featureId))

    const id = makeId()
    const ordinal = (maxOrdinalResult[0]?.maxOrdinal ?? 0) + 1

    await db.insert(featureRequirements).values({
      id,
      featureId,
      sourceId: body.sourceId ?? null,
      ordinal,
      title: body.title,
      description: body.description,
      status: body.status,
      sourceExcerpt: body.sourceExcerpt ?? null,
      sourceLocation: body.sourceLocation ?? null,
      sourceMethod: body.sourceMethod,
      aiConfidence: body.aiConfidence?.toFixed(2) ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })

    await markFeatureDirty(featureId)

    const [created] = await db.select().from(featureRequirements).where(eq(featureRequirements.id, id)).limit(1)
    return reply.code(201).send(mapFeatureRequirement(created))
  })

  app.patch('/api/features/:featureId/requirements/:requirementId', async (request, reply) => {
    const { featureId, requirementId } = request.params as { featureId: string; requirementId: string }
    const body = parseBody(UpdateRequirementRequestSchema, request.body)

    const [current] = await db
      .select()
      .from(featureRequirements)
      .where(and(eq(featureRequirements.id, requirementId), eq(featureRequirements.featureId, featureId)))
      .limit(1)

    if (!current) {
      return reply.code(404).send({ message: 'Requirement not found' })
    }

    await db
      .update(featureRequirements)
      .set({
        ...(body.title ? { title: body.title } : {}),
        ...(body.description ? { description: body.description } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.sourceExcerpt !== undefined ? { sourceExcerpt: body.sourceExcerpt } : {}),
        ...(body.sourceLocation !== undefined ? { sourceLocation: body.sourceLocation } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(featureRequirements.id, requirementId))

    await markFeatureDirty(featureId)
    const [updated] = await db.select().from(featureRequirements).where(eq(featureRequirements.id, requirementId)).limit(1)
    return mapFeatureRequirement(updated)
  })

  app.post('/api/features/:featureId/requirements/reorder', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(ReorderRequirementsRequestSchema, request.body)

    const existing = await db
      .select({ id: featureRequirements.id })
      .from(featureRequirements)
      .where(eq(featureRequirements.featureId, featureId))

    const existingIds = new Set(existing.map((item) => item.id))
    for (const id of body.requirementIds) {
      if (!existingIds.has(id)) {
        return reply.code(400).send({ message: `Unknown requirement id: ${id}` })
      }
    }

    for (let idx = 0; idx < body.requirementIds.length; idx += 1) {
      await db
        .update(featureRequirements)
        .set({ ordinal: idx + 1, updatedAt: nowIso() })
        .where(eq(featureRequirements.id, body.requirementIds[idx]))
    }

    await markFeatureDirty(featureId)
    const rows = await db
      .select()
      .from(featureRequirements)
      .where(eq(featureRequirements.featureId, featureId))
      .orderBy(featureRequirements.ordinal)

    return ApiGetRequirementsResponseSchema.parse(rows.map(mapFeatureRequirement))
  })

  app.get('/api/features/:featureId/tracking-plan', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    const eventRows = await db.select().from(planEvents).where(eq(planEvents.trackingPlanId, plan.id)).orderBy(planEvents.ordinal)
    const eventIds = eventRows.map((event) => event.id)
    const propertyRows = eventIds.length
      ? await db.select().from(planEventProperties).where(inArray(planEventProperties.planEventId, eventIds)).orderBy(planEventProperties.ordinal)
      : []
    const linkRows = eventIds.length
      ? await db.select().from(planEventRequirementLinks).where(inArray(planEventRequirementLinks.planEventId, eventIds))
      : []

    return ApiGetTrackingPlanResponseSchema.parse({
      trackingPlan: mapTrackingPlan(plan),
      events: eventRows.map(mapPlanEvent),
      properties: propertyRows.map(mapPlanEventProperty),
      requirementLinks: linkRows.map(mapPlanEventRequirementLink),
    })
  })

  app.patch('/api/features/:featureId/tracking-plan', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(UpdateTrackingPlanRequestSchema, request.body)
    const plan = await getTrackingPlanByFeature(featureId)

    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    await db
      .update(trackingPlans)
      .set({
        ...(body.summary !== undefined ? { summary: body.summary } : {}),
        ...(body.generationState ? { generationState: body.generationState } : {}),
        ...(body.generationState === 'done' ? { lastGeneratedAt: nowIso() } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(trackingPlans.id, plan.id))

    await markFeatureDirty(featureId)

    const [updated] = await db.select().from(trackingPlans).where(eq(trackingPlans.id, plan.id)).limit(1)
    return mapTrackingPlan(updated)
  })

  app.post('/api/features/:featureId/tracking-plan/events', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(CreatePlanEventRequestSchema, request.body)

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    const maxOrdinalResult = await db
      .select({ maxOrdinal: sql<number>`coalesce(max(${planEvents.ordinal}), 0)` })
      .from(planEvents)
      .where(eq(planEvents.trackingPlanId, plan.id))

    const eventId = makeId()
    const ordinal = (maxOrdinalResult[0]?.maxOrdinal ?? 0) + 1

    await db.insert(planEvents).values({
      id: eventId,
      trackingPlanId: plan.id,
      ordinal,
      name: body.name ?? null,
      description: body.description ?? null,
      trigger: body.trigger ?? null,
      platformsJson: serializeJson(body.platforms),
      decisionType: body.decisionType,
      workflowState: body.workflowState,
      linkedCatalogEventId: body.linkedCatalogEventId ?? null,
      catalogBaseVersionNumber: body.catalogBaseVersionNumber ?? null,
      sourceMethod: body.sourceMethod,
      aiConfidence: body.aiConfidence?.toFixed(2) ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    })

    if (body.properties.length > 0) {
      await db.insert(planEventProperties).values(
        body.properties.map((property, idx) => ({
          id: makeId(),
          planEventId: eventId,
          ordinal: idx + 1,
          name: property.name,
          scope: property.scope,
          dataType: property.dataType,
          description: property.description ?? null,
          required: property.required,
          exampleValue: property.exampleValue ?? null,
          allowedValuesJson: property.allowedValuesJson ? serializeJson(property.allowedValuesJson) : null,
          sourceMethod: property.sourceMethod,
          aiConfidence: property.aiConfidence?.toFixed(2) ?? null,
        })),
      )
    }

    if (body.requirementIds.length > 0) {
      await db.insert(planEventRequirementLinks).values(
        body.requirementIds.map((requirementId) => ({
          id: makeId(),
          planEventId: eventId,
          requirementId,
        })),
      )
    }

    await markFeatureDirty(featureId)

    const [created] = await db.select().from(planEvents).where(eq(planEvents.id, eventId)).limit(1)
    return reply.code(201).send(mapPlanEvent(created))
  })

  app.patch('/api/features/:featureId/tracking-plan/events/:planEventId', async (request, reply) => {
    const { featureId, planEventId } = request.params as { featureId: string; planEventId: string }
    const body = parseBody(UpdatePlanEventRequestSchema, request.body)

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    const [event] = await db
      .select()
      .from(planEvents)
      .where(and(eq(planEvents.id, planEventId), eq(planEvents.trackingPlanId, plan.id)))
      .limit(1)

    if (!event) {
      return reply.code(404).send({ message: 'Plan event not found' })
    }

    await db
      .update(planEvents)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
        ...(body.platforms !== undefined ? { platformsJson: serializeJson(body.platforms) } : {}),
        ...(body.decisionType ? { decisionType: body.decisionType } : {}),
        ...(body.workflowState ? { workflowState: body.workflowState } : {}),
        ...(body.linkedCatalogEventId !== undefined ? { linkedCatalogEventId: body.linkedCatalogEventId } : {}),
        ...(body.catalogBaseVersionNumber !== undefined
          ? { catalogBaseVersionNumber: body.catalogBaseVersionNumber }
          : {}),
        ...(body.sourceMethod ? { sourceMethod: body.sourceMethod } : {}),
        ...(body.aiConfidence !== undefined ? { aiConfidence: body.aiConfidence?.toFixed(2) ?? null } : {}),
        updatedAt: nowIso(),
      })
      .where(eq(planEvents.id, planEventId))

    if (body.properties) {
      await db.delete(planEventProperties).where(eq(planEventProperties.planEventId, planEventId))
      if (body.properties.length > 0) {
        await db.insert(planEventProperties).values(
          body.properties.map((property, idx) => ({
            id: makeId(),
            planEventId,
            ordinal: idx + 1,
            name: property.name,
            scope: property.scope,
            dataType: property.dataType,
            description: property.description ?? null,
            required: property.required,
            exampleValue: property.exampleValue ?? null,
            allowedValuesJson: property.allowedValuesJson ? serializeJson(property.allowedValuesJson) : null,
            sourceMethod: property.sourceMethod,
            aiConfidence: property.aiConfidence?.toFixed(2) ?? null,
          })),
        )
      }
    }

    if (body.requirementIds) {
      await db.delete(planEventRequirementLinks).where(eq(planEventRequirementLinks.planEventId, planEventId))
      if (body.requirementIds.length > 0) {
        await db.insert(planEventRequirementLinks).values(
          body.requirementIds.map((requirementId) => ({
            id: makeId(),
            planEventId,
            requirementId,
          })),
        )
      }
    }

    await markFeatureDirty(featureId)
    const [updated] = await db.select().from(planEvents).where(eq(planEvents.id, planEventId)).limit(1)
    return mapPlanEvent(updated)
  })

  app.delete('/api/features/:featureId/tracking-plan/events/:planEventId', async (request, reply) => {
    const { featureId, planEventId } = request.params as { featureId: string; planEventId: string }
    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    await db.delete(planEvents).where(and(eq(planEvents.id, planEventId), eq(planEvents.trackingPlanId, plan.id)))
    await markFeatureDirty(featureId)
    return { ok: true }
  })

  app.post('/api/features/:featureId/tracking-plan/events/reorder', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(ReorderPlanEventsRequestSchema, request.body)

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    for (let idx = 0; idx < body.planEventIds.length; idx += 1) {
      await db
        .update(planEvents)
        .set({ ordinal: idx + 1, updatedAt: nowIso() })
        .where(and(eq(planEvents.id, body.planEventIds[idx]), eq(planEvents.trackingPlanId, plan.id)))
    }

    await markFeatureDirty(featureId)

    const rows = await db
      .select()
      .from(planEvents)
      .where(eq(planEvents.trackingPlanId, plan.id))
      .orderBy(planEvents.ordinal)
    return rows.map(mapPlanEvent)
  })

  app.post('/api/features/:featureId/tracking-plan/events/:planEventId/requirements', async (request, reply) => {
    const { featureId, planEventId } = request.params as { featureId: string; planEventId: string }
    const body = parseBody(LinkPlanRequirementRequestSchema, request.body)

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return reply.code(404).send({ message: 'Tracking plan not found' })
    }

    const [event] = await db
      .select()
      .from(planEvents)
      .where(and(eq(planEvents.id, planEventId), eq(planEvents.trackingPlanId, plan.id)))
      .limit(1)
    if (!event) {
      return reply.code(404).send({ message: 'Plan event not found' })
    }

    await db.insert(planEventRequirementLinks).values({
      id: makeId(),
      planEventId,
      requirementId: body.requirementId,
    })

    await markFeatureDirty(featureId)
    return { ok: true }
  })

  app.delete('/api/features/:featureId/tracking-plan/events/:planEventId/requirements/:requirementId', async (request) => {
    const { featureId, planEventId, requirementId } = request.params as {
      featureId: string
      planEventId: string
      requirementId: string
    }

    const plan = await getTrackingPlanByFeature(featureId)
    if (!plan) {
      return { ok: false }
    }

    await db
      .delete(planEventRequirementLinks)
      .where(and(eq(planEventRequirementLinks.planEventId, planEventId), eq(planEventRequirementLinks.requirementId, requirementId)))
    await markFeatureDirty(featureId)

    return { ok: true }
  })

  app.get('/api/features/:featureId/validation', async (request) => {
    const { featureId } = request.params as { featureId: string }
    const rows = await db
      .select()
      .from(validationIssues)
      .where(eq(validationIssues.featureId, featureId))
      .orderBy(desc(validationIssues.createdAt))

    const issues = rows.map(mapValidationIssue)
    return ApiGetValidationResponseSchema.parse({
      issues,
      summary: {
        blockers: issues.filter((issue) => issue.severity === 'blocker').length,
        warnings: issues.filter((issue) => issue.severity === 'warning').length,
        info: issues.filter((issue) => issue.severity === 'info').length,
        dismissed: issues.filter((issue) => issue.isDismissed).length,
      },
    })
  })

  app.post('/api/features/:featureId/validation/recompute', async (request) => {
    const { featureId } = request.params as { featureId: string }
    const recomputed = await recomputeValidationForFeature(featureId)
    return ApiGetValidationResponseSchema.parse({
      issues: recomputed.issues.map(mapValidationIssue),
      summary: recomputed.summary,
    })
  })

  app.get('/api/features/:featureId/comments', async (request) => {
    const { featureId } = request.params as { featureId: string }

    const threadRows = await db
      .select()
      .from(commentThreads)
      .where(eq(commentThreads.featureId, featureId))
      .orderBy(desc(commentThreads.updatedAt))

    const threadIds = threadRows.map((thread) => thread.id)
    const commentRows = threadIds.length
      ? await db.select().from(comments).where(inArray(comments.threadId, threadIds)).orderBy(desc(comments.createdAt))
      : []

    return ApiGetFeatureCommentsResponseSchema.parse({
      threads: threadRows.map(mapCommentThread),
      comments: commentRows.map(mapComment),
    })
  })

  app.post('/api/features/:featureId/comments/threads', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(CreateThreadRequestSchema, request.body)

    const threadId = makeId()
    const now = nowIso()

    await db.insert(commentThreads).values({
      id: threadId,
      featureId,
      entityType: body.entityType,
      entityId: body.entityId,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    })

    await db.insert(comments).values({
      id: makeId(),
      threadId,
      authorName: body.actorName,
      body: body.initialComment,
      createdAt: now,
    })

    return reply.code(201).send({ threadId })
  })

  app.post('/api/comment-threads/:threadId/comments', async (request, reply) => {
    const { threadId } = request.params as { threadId: string }
    const body = parseBody(CreateCommentRequestSchema, request.body)

    const [thread] = await db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).limit(1)
    if (!thread) {
      return reply.code(404).send({ message: 'Comment thread not found' })
    }

    const id = makeId()
    await db.insert(comments).values({
      id,
      threadId,
      authorName: body.actorName,
      body: body.body,
      createdAt: nowIso(),
    })

    await db.update(commentThreads).set({ updatedAt: nowIso() }).where(eq(commentThreads.id, threadId))

    const [created] = await db.select().from(comments).where(eq(comments.id, id)).limit(1)
    return reply.code(201).send(mapComment(created))
  })

  app.patch('/api/comment-threads/:threadId', async (request, reply) => {
    const { threadId } = request.params as { threadId: string }
    const body = parseBody(UpdateThreadRequestSchema, request.body)

    const [thread] = await db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).limit(1)
    if (!thread) {
      return reply.code(404).send({ message: 'Comment thread not found' })
    }

    await db
      .update(commentThreads)
      .set({ status: body.status, updatedAt: nowIso() })
      .where(eq(commentThreads.id, threadId))

    const [updated] = await db.select().from(commentThreads).where(eq(commentThreads.id, threadId)).limit(1)
    return mapCommentThread(updated)
  })

  app.post('/api/features/:featureId/ai-runs', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    if (!isAiEnabled()) {
      return reply.code(400).send({ message: 'AI is disabled. Set OPENAI_API_KEY and AI_MODEL to enable AI runs.' })
    }

    const body = parseBody(CreateAiRunRequestSchema, request.body)
    const runId = await createAndStartAiRun(featureId, { runType: body.runType, input: body.input })

    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.id, runId)).limit(1)
    return reply.code(202).send(ApiGetAiRunResponseSchema.parse(mapAiRun(run)))
  })

  app.get('/api/ai-runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string }
    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.id, runId)).limit(1)

    if (!run) {
      return reply.code(404).send({ message: 'AI run not found' })
    }

    return ApiGetAiRunResponseSchema.parse(mapAiRun(run))
  })

  app.get('/api/ai-runs/:runId/stream', async (request, reply) => {
    const { runId } = request.params as { runId: string }

    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.flushHeaders()

    const writeEvent = (event: string, data: unknown): void => {
      reply.raw.write(`event: ${event}\n`)
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    const [run] = await db.select().from(aiRuns).where(eq(aiRuns.id, runId)).limit(1)
    if (run) {
      writeEvent('status', mapAiRun(run))
    }

    const unsubscribe = subscribeAiRun(runId, (payload) => writeEvent(payload.event, payload.data))

    const heartbeat = setInterval(() => {
      writeEvent('heartbeat', { at: nowIso() })
    }, 15000)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
      if (!reply.raw.closed) {
        reply.raw.end()
      }
    })

    return reply.hijack()
  })

  app.post('/api/features/:featureId/publish', async (request, reply) => {
    const { featureId } = request.params as { featureId: string }
    const body = parseBody(PublishFeatureRequestSchema, request.body)

    try {
      const result = await publishTrackingPlan(featureId, body)
      return reply.code(201).send(result)
    } catch (error) {
      const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500
      return reply.code(statusCode).send({
        message: error instanceof Error ? error.message : 'Publish failed',
        issues: (error as Error & { issues?: unknown }).issues,
      })
    }
  })

  app.get('/api/features/:featureId/releases', async (request) => {
    const { featureId } = request.params as { featureId: string }
    const rows = await db
      .select()
      .from(trackingPlanReleases)
      .where(eq(trackingPlanReleases.featureId, featureId))
      .orderBy(desc(trackingPlanReleases.releaseNumber))

    return ApiGetFeatureReleasesResponseSchema.parse(rows.map(mapTrackingPlanRelease))
  })

  app.get('/api/releases/:releaseId', async (request, reply) => {
    const { releaseId } = request.params as { releaseId: string }
    const [release] = await db.select().from(trackingPlanReleases).where(eq(trackingPlanReleases.id, releaseId)).limit(1)
    if (!release) {
      return reply.code(404).send({ message: 'Release not found' })
    }

    const versionRows = await db
      .select()
      .from(catalogEventVersions)
      .where(eq(catalogEventVersions.sourceReleaseId, releaseId))
      .orderBy(desc(catalogEventVersions.createdAt))

    return ApiGetReleaseResponseSchema.parse({
      release: mapTrackingPlanRelease(release),
      versions: versionRows.map(mapCatalogEventVersion),
    })
  })

  app.get('/api/catalog/events', async () => {
    const rows = await db.select().from(catalogEvents).orderBy(desc(catalogEvents.updatedAt))
    return ApiListCatalogEventsResponseSchema.parse(rows.map(mapCatalogEvent))
  })

  app.post('/api/catalog/events', async (request, reply) => {
    const body = parseBody(UpsertCatalogEventRequestSchema, request.body)

    try {
      const result = await publishAdhocCatalogEvent(body)
      return reply.code(201).send(result)
    } catch (error) {
      return reply.code((error as Error & { statusCode?: number }).statusCode ?? 500).send({
        message: error instanceof Error ? error.message : 'Catalog publish failed',
      })
    }
  })

  app.get('/api/catalog/events/:eventId', async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const [event] = await db.select().from(catalogEvents).where(eq(catalogEvents.id, eventId)).limit(1)
    if (!event) {
      return reply.code(404).send({ message: 'Catalog event not found' })
    }

    const props = await db.select().from(catalogEventProperties).where(eq(catalogEventProperties.catalogEventId, eventId))
    const propIds = props.map((item) => item.propertyId)
    const registry = propIds.length
      ? await db.select().from(catalogProperties).where(inArray(catalogProperties.id, propIds))
      : []

    const registryMap = new Map(registry.map((item) => [item.id, item]))

    return ApiGetCatalogEventResponseSchema.parse({
      event: mapCatalogEvent(event),
      properties: props
        .map((item) => {
          const property = registryMap.get(item.propertyId)
          if (!property) {
            return null
          }

          return {
            property: mapCatalogProperty(property),
            scope: item.scope,
            required: item.required,
            exampleValue: item.exampleValue,
            notes: item.notes,
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    })
  })

  app.patch('/api/catalog/events/:eventId', async (request, reply) => {
    const { eventId } = request.params as { eventId: string }
    const body = parseBody(UpsertCatalogEventRequestSchema, request.body)

    try {
      const result = await publishAdhocCatalogEvent(body, eventId)
      return reply.code(200).send(result)
    } catch (error) {
      return reply.code((error as Error & { statusCode?: number }).statusCode ?? 500).send({
        message: error instanceof Error ? error.message : 'Catalog update failed',
      })
    }
  })

  app.get('/api/catalog/events/:eventId/versions', async (request) => {
    const { eventId } = request.params as { eventId: string }
    const rows = await db
      .select()
      .from(catalogEventVersions)
      .where(eq(catalogEventVersions.catalogEventId, eventId))
      .orderBy(desc(catalogEventVersions.versionNumber))

    return ApiListCatalogEventVersionsResponseSchema.parse(rows.map(mapCatalogEventVersion))
  })

  app.get('/api/catalog/properties', async () => {
    const rows = await db.select().from(catalogProperties).orderBy(catalogProperties.name)
    return ApiListCatalogPropertiesResponseSchema.parse(rows.map(mapCatalogProperty))
  })

  app.get('/api/catalog/search', async (request) => {
    const q = ((request.query as { q?: string }).q ?? '').trim()
    if (!q) {
      return SearchCatalogResponseSchema.parse({ events: [], properties: [] })
    }

    const eventRows = await db.select().from(catalogEvents).where(like(catalogEvents.name, `%${q}%`)).limit(50)
    const propertyRows = await db
      .select()
      .from(catalogProperties)
      .where(like(catalogProperties.name, `%${q}%`))
      .limit(50)

    return SearchCatalogResponseSchema.parse({
      events: eventRows.map(mapCatalogEvent),
      properties: propertyRows.map(mapCatalogProperty),
    })
  })

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ message: 'Not found' })
  })

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)

    if ((error as { validation?: unknown }).validation) {
      return reply.code(400).send({ message: 'Invalid request', detail: error.message })
    }

    return reply.code(500).send({ message: 'Internal server error', detail: error.message })
  })
}
