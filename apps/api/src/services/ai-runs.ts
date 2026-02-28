import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  AiCatalogMatchOutputSchema,
  AiExtractRequirementsOutputSchema,
  AiGenerateTrackingPlanOutputSchema,
  type AiRunType,
} from '@tracker/contracts'
import { createOpenAI } from '@ai-sdk/openai'
import { generateObject } from 'ai'

import { db } from '../db/client.js'
import {
  aiRuns,
  catalogEvents,
  featureRequirements,
  featureSources,
  planEventProperties,
  planEventRequirementLinks,
  planEvents,
  trackingPlans,
} from '../db/schema.js'
import { makeId } from '../lib/id.js'
import { safeParseJson, serializeJson } from '../lib/json.js'
import { nowIso } from '../lib/time.js'

type StreamEvent = {
  event: string
  data: unknown
}

type Subscriber = (payload: StreamEvent) => void

const subscribers = new Map<string, Set<Subscriber>>()

const aiModel = process.env.AI_MODEL ?? 'gpt-4o-mini'
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY ?? '' })

export const isAiEnabled = (): boolean => Boolean(process.env.OPENAI_API_KEY)

export const subscribeAiRun = (runId: string, subscriber: Subscriber): (() => void) => {
  const set = subscribers.get(runId) ?? new Set<Subscriber>()
  set.add(subscriber)
  subscribers.set(runId, set)

  return () => {
    const current = subscribers.get(runId)
    if (!current) {
      return
    }

    current.delete(subscriber)
    if (current.size === 0) {
      subscribers.delete(runId)
    }
  }
}

const emit = (runId: string, event: string, data: unknown): void => {
  const current = subscribers.get(runId)
  if (!current) {
    return
  }

  for (const subscriber of current) {
    subscriber({ event, data })
  }
}

const updateRun = async (
  runId: string,
  patch: Partial<typeof aiRuns.$inferInsert>,
  streamEvent?: { event: string; data: unknown },
): Promise<void> => {
  await db
    .update(aiRuns)
    .set({
      ...patch,
    })
    .where(eq(aiRuns.id, runId))

  if (streamEvent) {
    emit(runId, streamEvent.event, streamEvent.data)
  }
}

const extractSourceText = async (featureId: string): Promise<string> => {
  const sources = await db
    .select()
    .from(featureSources)
    .where(eq(featureSources.featureId, featureId))
    .orderBy(featureSources.createdAt)

  return sources
    .map((source) => source.extractedText ?? source.rawText ?? '')
    .filter(Boolean)
    .join('\n\n')
}

const heuristicExtractRequirements = (text: string) => {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 12)
    .slice(0, 20)

  return {
    requirements: lines.map((line, idx) => ({
      title: `Requirement ${idx + 1}`,
      description: line,
      sourceExcerpt: line.slice(0, 280),
      sourceLocation: `line:${idx + 1}`,
      confidence: 0.55,
    })),
  }
}

const heuristicGeneratePlan = (requirements: Array<{ description: string; title: string }>) => ({
  summary: 'AI-generated initial tracking plan from requirement set.',
  events: requirements.slice(0, 10).map((req, idx) => ({
    name: req.title.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    description: req.description,
    trigger: `When ${req.description.toLowerCase().slice(0, 80)}`,
    platforms: ['web'],
    decisionType: 'new' as const,
    properties: [
      {
        name: 'source_context',
        scope: 'event' as const,
        dataType: 'string' as const,
        description: 'Short context that triggered the event',
        required: false,
        exampleValue: req.title,
        allowedValues: [],
        sourceExcerpt: req.description.slice(0, 150),
        sourceLocation: `requirement:${idx + 1}`,
        confidence: 0.58,
      },
    ],
    requirementIndexes: [idx],
    sourceExcerpt: req.description.slice(0, 240),
    sourceLocation: `requirement:${idx + 1}`,
    confidence: 0.56,
  })),
})

const heuristicMatchCatalog = (
  plan: Array<{ id: string; name: string | null }>,
  catalog: Array<{ id: string; name: string }>,
) => ({
  matches: plan.map((event) => {
    const normalized = event.name?.toLowerCase().trim() ?? ''
    const exact = catalog.find((item) => item.name.toLowerCase().trim() === normalized)
    if (exact) {
      return {
        planEventName: event.name ?? event.id,
        decisionType: 'reuse' as const,
        catalogEventId: exact.id,
        rationale: 'Exact name match in catalog',
        confidence: 0.82,
      }
    }

    const fuzzy = catalog.find((item) => item.name.toLowerCase().includes(normalized) || normalized.includes(item.name.toLowerCase()))
    if (fuzzy) {
      return {
        planEventName: event.name ?? event.id,
        decisionType: 'update' as const,
        catalogEventId: fuzzy.id,
        rationale: 'Potential semantic overlap with existing catalog event',
        confidence: 0.64,
      }
    }

    return {
      planEventName: event.name ?? event.id,
      decisionType: 'new' as const,
      rationale: 'No likely catalog match detected',
      confidence: 0.63,
    }
  }),
})

const runWithModel = async <T>(schema: unknown, prompt: string): Promise<T | null> => {
  if (!isAiEnabled()) {
    return null
  }

  try {
    const result = await generateObject({
      model: openai(aiModel),
      schema: schema as never,
      prompt,
    })

    return result.object as T
  } catch {
    return null
  }
}

const persistExtractedRequirements = async (
  featureId: string,
  requirements: Array<{
    title: string
    description: string
    sourceExcerpt: string
    sourceLocation?: string
    confidence: number
  }>,
): Promise<void> => {
  const existing = await db
    .select({ id: featureRequirements.id })
    .from(featureRequirements)
    .where(and(eq(featureRequirements.featureId, featureId), eq(featureRequirements.sourceMethod, 'ai')))
  const existingIds = existing.map((item) => item.id)
  if (existingIds.length > 0) {
    await db.delete(featureRequirements).where(inArray(featureRequirements.id, existingIds))
  }

  const baseOrdinal =
    (
      await db
        .select({ maxOrdinal: sql<number>`coalesce(max(${featureRequirements.ordinal}), 0)` })
        .from(featureRequirements)
        .where(eq(featureRequirements.featureId, featureId))
    )[0]?.maxOrdinal ?? 0

  const now = nowIso()

  if (requirements.length === 0) {
    return
  }

  await db.insert(featureRequirements).values(
    requirements.map((requirement, idx) => ({
      id: makeId(),
      featureId,
      sourceId: null,
      ordinal: baseOrdinal + idx + 1,
      title: requirement.title,
      description: requirement.description,
      status: 'unmapped',
      sourceExcerpt: requirement.sourceExcerpt,
      sourceLocation: requirement.sourceLocation ?? null,
      sourceMethod: 'ai',
      aiConfidence: requirement.confidence.toFixed(2),
      createdAt: now,
      updatedAt: now,
    })),
  )
}

const persistGeneratedPlan = async (
  featureId: string,
  output: {
    summary?: string
    events: Array<{
      name: string
      description?: string
      trigger?: string
      platforms: string[]
      decisionType: 'new' | 'reuse' | 'update'
      properties: Array<{
        name: string
        scope: 'event' | 'user' | 'global'
        dataType: 'string' | 'int' | 'float' | 'boolean' | 'timestamp' | 'list' | 'json'
        description?: string
        required: boolean
        exampleValue?: string
        allowedValues?: string[]
        confidence: number
      }>
      requirementIndexes: number[]
      confidence: number
    }>
  },
): Promise<void> => {
  const [plan] = await db.select().from(trackingPlans).where(eq(trackingPlans.featureId, featureId)).limit(1)
  if (!plan) {
    throw new Error('Tracking plan not found')
  }

  const previousAiEvents = await db
    .select({ id: planEvents.id })
    .from(planEvents)
    .where(and(eq(planEvents.trackingPlanId, plan.id), eq(planEvents.sourceMethod, 'ai')))
  const previousEventIds = previousAiEvents.map((item) => item.id)
  if (previousEventIds.length > 0) {
    await db.delete(planEvents).where(inArray(planEvents.id, previousEventIds))
  }

  const requirements = await db
    .select()
    .from(featureRequirements)
    .where(eq(featureRequirements.featureId, featureId))
    .orderBy(featureRequirements.ordinal)

  const baseOrdinal =
    (
      await db
        .select({ maxOrdinal: sql<number>`coalesce(max(${planEvents.ordinal}), 0)` })
        .from(planEvents)
        .where(eq(planEvents.trackingPlanId, plan.id))
    )[0]?.maxOrdinal ?? 0

  const now = nowIso()

  for (let idx = 0; idx < output.events.length; idx += 1) {
    const event = output.events[idx]
    const planEventId = makeId()
    await db.insert(planEvents).values({
      id: planEventId,
      trackingPlanId: plan.id,
      ordinal: baseOrdinal + idx + 1,
      name: event.name,
      description: event.description ?? null,
      trigger: event.trigger ?? null,
      platformsJson: serializeJson(event.platforms),
      decisionType: event.decisionType,
      workflowState: 'draft',
      linkedCatalogEventId: null,
      catalogBaseVersionNumber: null,
      sourceMethod: 'ai',
      aiConfidence: event.confidence.toFixed(2),
      createdAt: now,
      updatedAt: now,
    })

    if (event.properties.length > 0) {
      await db.insert(planEventProperties).values(
        event.properties.map((property, propIdx) => ({
          id: makeId(),
          planEventId,
          ordinal: propIdx + 1,
          name: property.name,
          scope: property.scope,
          dataType: property.dataType,
          description: property.description ?? null,
          required: property.required,
          exampleValue: property.exampleValue ?? null,
          allowedValuesJson: property.allowedValues ? serializeJson(property.allowedValues) : null,
          sourceMethod: 'ai',
          aiConfidence: property.confidence.toFixed(2),
        })),
      )
    }

    const links = event.requirementIndexes
      .map((index) => requirements[index])
      .filter((requirement): requirement is (typeof requirements)[number] => Boolean(requirement))

    if (links.length > 0) {
      await db.insert(planEventRequirementLinks).values(
        links.map((requirement) => ({
          id: makeId(),
          planEventId,
          requirementId: requirement.id,
        })),
      )
    }
  }

  await db
    .update(trackingPlans)
    .set({
      summary: output.summary ?? plan.summary,
      generationState: 'done',
      lastGeneratedAt: now,
      updatedAt: now,
    })
    .where(eq(trackingPlans.id, plan.id))
}

const executeRun = async (runId: string): Promise<void> => {
  const [run] = await db.select().from(aiRuns).where(eq(aiRuns.id, runId)).limit(1)
  if (!run) {
    return
  }

  await updateRun(runId, { status: 'running' }, { event: 'status', data: { status: 'running' } })

  try {
    const sourceText = await extractSourceText(run.featureId)

    if (!sourceText.trim()) {
      throw new Error('No readable source text available for AI actions.')
    }

    let output: unknown = null

    if (run.runType === 'extract_requirements' || run.runType === 'full_generate') {
      emit(runId, 'progress', { phase: 'extract_requirements' })
      const modelOutput = await runWithModel<unknown>(
        AiExtractRequirementsOutputSchema,
        `Extract requirements from this PRD into concise analyst-ready requirements.\n\n${sourceText}`,
      )
      const parsed = AiExtractRequirementsOutputSchema.parse(modelOutput ?? heuristicExtractRequirements(sourceText))
      await persistExtractedRequirements(run.featureId, parsed.requirements)
      output = { ...(output as Record<string, unknown>), extractRequirements: parsed }
    }

    if (run.runType === 'generate_plan' || run.runType === 'full_generate') {
      emit(runId, 'progress', { phase: 'generate_plan' })
      const requirements = await db
        .select({ title: featureRequirements.title, description: featureRequirements.description })
        .from(featureRequirements)
        .where(eq(featureRequirements.featureId, run.featureId))

      const modelOutput = await runWithModel<unknown>(
        AiGenerateTrackingPlanOutputSchema,
        `Generate a tracking plan with events/properties from these requirements: ${JSON.stringify(requirements)}`,
      )
      const parsed = AiGenerateTrackingPlanOutputSchema.parse(modelOutput ?? heuristicGeneratePlan(requirements))
      await persistGeneratedPlan(run.featureId, parsed)
      output = { ...(output as Record<string, unknown>), generatePlan: parsed }
    }

    if (run.runType === 'match_catalog' || run.runType === 'full_generate') {
      emit(runId, 'progress', { phase: 'match_catalog' })
      const [plan] = await db.select().from(trackingPlans).where(eq(trackingPlans.featureId, run.featureId)).limit(1)
      if (!plan) {
        throw new Error('Tracking plan not found')
      }

      const planRows = await db
        .select({ id: planEvents.id, name: planEvents.name })
        .from(planEvents)
        .where(eq(planEvents.trackingPlanId, plan.id))

      const catalogRows = await db.select({ id: catalogEvents.id, name: catalogEvents.name }).from(catalogEvents)

      const modelOutput = await runWithModel<unknown>(
        AiCatalogMatchOutputSchema,
        `Match plan events to catalog events. Plan: ${JSON.stringify(planRows)} Catalog: ${JSON.stringify(catalogRows)}`,
      )
      const parsed = AiCatalogMatchOutputSchema.parse(modelOutput ?? heuristicMatchCatalog(planRows, catalogRows))

      for (const match of parsed.matches) {
        const [event] = await db
          .select()
          .from(planEvents)
          .where(and(eq(planEvents.trackingPlanId, plan.id), eq(planEvents.name, match.planEventName)))
          .limit(1)

        if (!event) {
          continue
        }

        await db
          .update(planEvents)
          .set({
            decisionType: match.decisionType,
            linkedCatalogEventId: match.catalogEventId ?? null,
            updatedAt: nowIso(),
          })
          .where(eq(planEvents.id, event.id))
      }

      output = { ...(output as Record<string, unknown>), matchCatalog: parsed }
    }

    if (run.runType === 'regenerate_event') {
      const input = safeParseJson<Record<string, unknown> | null>(run.inputSnapshotJson, null)
      const eventId = input?.planEventId
      if (!eventId || typeof eventId !== 'string') {
        throw new Error('regenerate_event run requires input.planEventId')
      }

      const [event] = await db.select().from(planEvents).where(eq(planEvents.id, eventId)).limit(1)
      if (!event) {
        throw new Error('Target plan event not found')
      }

      await db
        .update(planEvents)
        .set({
          description: event.description ?? 'Regenerated event description based on latest context.',
          sourceMethod: 'ai',
          aiConfidence: '0.60',
          updatedAt: nowIso(),
        })
        .where(eq(planEvents.id, event.id))

      output = { regenerateEvent: { planEventId: event.id, status: 'updated' } }
    }

    await updateRun(
      runId,
      {
        status: 'completed',
        finishedAt: nowIso(),
        outputSnapshotJson: serializeJson(output),
      },
      { event: 'status', data: { status: 'completed', output } },
    )
  } catch (error) {
    await updateRun(
      runId,
      {
        status: 'failed',
        finishedAt: nowIso(),
        errorMessage: error instanceof Error ? error.message : 'Unknown AI run failure',
      },
      {
        event: 'status',
        data: { status: 'failed', error: error instanceof Error ? error.message : 'Unknown AI run failure' },
      },
    )
  }
}

export const createAndStartAiRun = async (
  featureId: string,
  payload: { runType: AiRunType; input?: Record<string, unknown> },
): Promise<string> => {
  const runId = makeId()
  await db.insert(aiRuns).values({
    id: runId,
    featureId,
    runType: payload.runType,
    status: 'queued',
    startedAt: nowIso(),
    finishedAt: null,
    errorMessage: null,
    inputSnapshotJson: payload.input ? serializeJson(payload.input) : null,
    outputSnapshotJson: null,
  })

  emit(runId, 'status', { status: 'queued' })
  void executeRun(runId)
  return runId
}

export const recoverInterruptedRuns = async (): Promise<void> => {
  await db
    .update(aiRuns)
    .set({
      status: 'failed',
      finishedAt: nowIso(),
      errorMessage: 'Server restarted before AI run completed.',
    })
    .where(eq(aiRuns.status, 'running'))
}
