import { and, eq, inArray } from 'drizzle-orm'
import { validationCodes } from '@tracker/contracts'

import { db } from '../db/client.js'
import {
  catalogEvents,
  catalogProperties,
  featureRequirements,
  planEventProperties,
  planEventRequirementLinks,
  planEvents,
  trackingPlans,
  validationIssues,
} from '../db/schema.js'
import { makeId } from '../lib/id.js'
import { nowIso } from '../lib/time.js'
import { normalizeName } from '../lib/strings.js'

type ValidationResult = {
  issues: Array<typeof validationIssues.$inferSelect>
  summary: {
    blockers: number
    warnings: number
    info: number
    dismissed: number
  }
}

const buildSummary = (issues: Array<typeof validationIssues.$inferInsert>) => ({
  blockers: issues.filter((issue) => issue.severity === 'blocker').length,
  warnings: issues.filter((issue) => issue.severity === 'warning').length,
  info: issues.filter((issue) => issue.severity === 'info').length,
  dismissed: issues.filter((issue) => issue.isDismissed).length,
})

export const recomputeValidationForFeature = async (featureId: string): Promise<ValidationResult> => {
  const [plan] = await db.select().from(trackingPlans).where(eq(trackingPlans.featureId, featureId)).limit(1)
  if (!plan) {
    return { issues: [], summary: { blockers: 0, warnings: 0, info: 0, dismissed: 0 } }
  }

  const planEventRows = await db.select().from(planEvents).where(eq(planEvents.trackingPlanId, plan.id))
  const planEventIds = planEventRows.map((event) => event.id)

  const propertyRows = planEventIds.length
    ? await db.select().from(planEventProperties).where(inArray(planEventProperties.planEventId, planEventIds))
    : []

  const linkRows = planEventIds.length
    ? await db.select().from(planEventRequirementLinks).where(inArray(planEventRequirementLinks.planEventId, planEventIds))
    : []

  const requirementRows = await db.select().from(featureRequirements).where(eq(featureRequirements.featureId, featureId))
  const registryRows = await db.select().from(catalogProperties)

  const linkedCatalogIds = Array.from(
    new Set(planEventRows.map((event) => event.linkedCatalogEventId).filter((id): id is string => Boolean(id))),
  )
  const linkedCatalogRows = linkedCatalogIds.length
    ? await db.select().from(catalogEvents).where(inArray(catalogEvents.id, linkedCatalogIds))
    : []

  const linkedCatalogMap = new Map(linkedCatalogRows.map((event) => [event.id, event]))

  const issues: Array<typeof validationIssues.$inferInsert> = []
  const timestamp = nowIso()

  const eventNameGroups = new Map<string, string[]>()
  for (const event of planEventRows) {
    const normalizedName = event.name?.trim().toLowerCase()
    if (!normalizedName) {
      continue
    }
    eventNameGroups.set(normalizedName, [...(eventNameGroups.get(normalizedName) ?? []), event.id])
  }

  for (const [name, ids] of eventNameGroups.entries()) {
    if (ids.length < 2) {
      continue
    }

    for (const eventId of ids) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: eventId,
        severity: 'blocker',
        code: validationCodes.duplicate_plan_event_name,
        title: 'Duplicate event name',
        message: `Event name \"${name}\" appears multiple times in this tracking plan.`,
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }
  }

  const propsByEvent = new Map<string, Array<typeof planEventProperties.$inferSelect>>()
  for (const row of propertyRows) {
    propsByEvent.set(row.planEventId, [...(propsByEvent.get(row.planEventId) ?? []), row])
  }

  for (const event of planEventRows) {
    if (!event.name?.trim()) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: event.id,
        severity: 'blocker',
        code: validationCodes.missing_event_name,
        title: 'Missing event name',
        message: 'Each plan event must have a name before publish.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }

    if (!event.trigger?.trim()) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: event.id,
        severity: 'blocker',
        code: validationCodes.missing_event_trigger,
        title: 'Missing trigger definition',
        message: 'Each plan event must define what triggers it.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }

    if (!event.description?.trim()) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: event.id,
        severity: 'blocker',
        code: validationCodes.missing_required_description,
        title: 'Missing event description',
        message: 'Each plan event requires a description before publish.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }

    if (event.decisionType === 'update' && !event.linkedCatalogEventId) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: event.id,
        severity: 'blocker',
        code: validationCodes.update_without_catalog_target,
        title: 'Update decision has no catalog target',
        message: 'Update events must link to a target Catalog event.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }

    const eventProps = propsByEvent.get(event.id) ?? []
    const seen = new Set<string>()
    for (const prop of eventProps) {
      const key = `${normalizeName(prop.name)}:${prop.scope}`
      if (seen.has(key)) {
        issues.push({
          id: makeId(),
          featureId,
          trackingPlanId: plan.id,
          entityType: 'plan_event_property',
          entityId: prop.id,
          severity: 'blocker',
          code: validationCodes.duplicate_property_name_in_event_scope,
          title: 'Duplicate property in scope',
          message: `Duplicate property \"${prop.name}\" in scope \"${prop.scope}\" for one event.`,
          source: 'rule',
          isDismissed: false,
          dismissedReason: null,
          createdAt: timestamp,
        })
      }
      seen.add(key)

      if (!prop.description?.trim()) {
        issues.push({
          id: makeId(),
          featureId,
          trackingPlanId: plan.id,
          entityType: 'plan_event_property',
          entityId: prop.id,
          severity: 'warning',
          code: validationCodes.property_description_missing,
          title: 'Missing property description',
          message: `Property \"${prop.name}\" has no description.`,
          source: 'rule',
          isDismissed: false,
          dismissedReason: null,
          createdAt: timestamp,
        })
      }

      const normalized = normalizeName(prop.name)
      const conflictingRegistry = registryRows.find(
        (registry) => registry.normalizedName === normalized && registry.dataType !== prop.dataType,
      )
      if (conflictingRegistry) {
        issues.push({
          id: makeId(),
          featureId,
          trackingPlanId: plan.id,
          entityType: 'plan_event_property',
          entityId: prop.id,
          severity: 'blocker',
          code: validationCodes.property_datatype_conflict_with_registry,
          title: 'Property data type conflict',
          message: `Property \"${prop.name}\" conflicts with registry type \"${conflictingRegistry.dataType}\".`,
          source: 'rule',
          isDismissed: false,
          dismissedReason: null,
          createdAt: timestamp,
        })
      }
    }

    const eventLinks = linkRows.filter((link) => link.planEventId === event.id)
    if (eventLinks.length === 0) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'plan_event',
        entityId: event.id,
        severity: 'warning',
        code: validationCodes.plan_event_without_requirement,
        title: 'Plan event has no requirement mapping',
        message: 'Map this event to at least one requirement or mark it as intentional.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }

    if (event.decisionType === 'reuse' && event.linkedCatalogEventId) {
      const linked = linkedCatalogMap.get(event.linkedCatalogEventId)
      if (linked?.status === 'deprecated') {
        issues.push({
          id: makeId(),
          featureId,
          trackingPlanId: plan.id,
          entityType: 'plan_event',
          entityId: event.id,
          severity: 'warning',
          code: validationCodes.reused_deprecated_catalog_event,
          title: 'Reused deprecated catalog event',
          message: `Reused event \"${linked.name}\" is deprecated in catalog.`,
          source: 'rule',
          isDismissed: false,
          dismissedReason: null,
          createdAt: timestamp,
        })
      }
    }
  }

  const requirementLinkCounts = new Map<string, number>()
  for (const link of linkRows) {
    requirementLinkCounts.set(link.requirementId, (requirementLinkCounts.get(link.requirementId) ?? 0) + 1)
  }

  const inScopeRequirements = requirementRows.filter((requirement) => requirement.status !== 'out_of_scope')

  if (inScopeRequirements.length > 0) {
    const mappedCount = inScopeRequirements.filter((requirement) => (requirementLinkCounts.get(requirement.id) ?? 0) > 0).length
    if (mappedCount === 0) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'feature',
        entityId: featureId,
        severity: 'blocker',
        code: validationCodes.zero_mapped_events_for_in_scope_requirements,
        title: 'No mapped events for in-scope requirements',
        message: 'At least one in-scope requirement must be mapped to a plan event.',
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }
  }

  for (const requirement of inScopeRequirements) {
    const links = requirementLinkCounts.get(requirement.id) ?? 0
    if (links === 0) {
      issues.push({
        id: makeId(),
        featureId,
        trackingPlanId: plan.id,
        entityType: 'requirement',
        entityId: requirement.id,
        severity: 'warning',
        code: validationCodes.requirement_partially_covered,
        title: 'Requirement not covered',
        message: `Requirement \"${requirement.title}\" is not mapped to any event.`,
        source: 'rule',
        isDismissed: false,
        dismissedReason: null,
        createdAt: timestamp,
      })
    }
  }

  await db.delete(validationIssues).where(and(eq(validationIssues.featureId, featureId), eq(validationIssues.source, 'rule')))
  if (issues.length > 0) {
    await db.insert(validationIssues).values(issues)
  }

  const storedIssues = await db.select().from(validationIssues).where(eq(validationIssues.featureId, featureId))
  return {
    issues: storedIssues,
    summary: buildSummary(storedIssues),
  }
}
