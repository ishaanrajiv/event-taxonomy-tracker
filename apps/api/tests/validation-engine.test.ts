import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../src/db/client.js'
import {
  features,
  trackingPlans,
  planEvents,
  validationIssues,
  planEventProperties,
  planEventRequirementLinks,
  featureRequirements,
  featureSources,
  commentThreads,
  comments,
  catalogEventProperties,
  catalogEventVersions,
  catalogEvents,
  catalogProperties,
  trackingPlanReleases,
  aiRuns,
} from '../src/db/schema.js'
import { ensureSchema } from '../src/db/init.js'
import { makeId } from '../src/lib/id.js'
import { nowIso } from '../src/lib/time.js'
import { recomputeValidationForFeature } from '../src/services/validation-engine.js'

const clearDb = async () => {
  await db.delete(comments)
  await db.delete(commentThreads)
  await db.delete(planEventRequirementLinks)
  await db.delete(planEventProperties)
  await db.delete(planEvents)
  await db.delete(featureRequirements)
  await db.delete(featureSources)
  await db.delete(validationIssues)
  await db.delete(aiRuns)
  await db.delete(catalogEventProperties)
  await db.delete(catalogEventVersions)
  await db.delete(catalogEvents)
  await db.delete(catalogProperties)
  await db.delete(trackingPlanReleases)
  await db.delete(trackingPlans)
  await db.delete(features)
}

describe('validation-engine', () => {
  beforeEach(async () => {
    ensureSchema()
    await clearDb()
  })

  it('flags duplicate event names and missing triggers as blockers', async () => {
    const featureId = makeId()
    const planId = makeId()
    const timestamp = nowIso()

    await db.insert(features).values({
      id: featureId,
      slug: `feat-${featureId.slice(0, 8)}`,
      title: 'Checkout instrumentation',
      summary: null,
      productArea: null,
      ownerName: null,
      targetRelease: null,
      workflowStatus: 'draft',
      hasUnpublishedChanges: false,
      lastPublishedReleaseNumber: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await db.insert(trackingPlans).values({
      id: planId,
      featureId,
      summary: null,
      generationState: 'idle',
      lastGeneratedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })

    await db.insert(planEvents).values([
      {
        id: makeId(),
        trackingPlanId: planId,
        ordinal: 1,
        name: 'checkout_started',
        description: 'User starts checkout',
        trigger: null,
        platformsJson: '[]',
        decisionType: 'new',
        workflowState: 'draft',
        linkedCatalogEventId: null,
        catalogBaseVersionNumber: null,
        sourceMethod: 'manual',
        aiConfidence: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      {
        id: makeId(),
        trackingPlanId: planId,
        ordinal: 2,
        name: 'checkout_started',
        description: 'Duplicate semantic event',
        trigger: null,
        platformsJson: '[]',
        decisionType: 'new',
        workflowState: 'draft',
        linkedCatalogEventId: null,
        catalogBaseVersionNumber: null,
        sourceMethod: 'manual',
        aiConfidence: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ])

    const result = await recomputeValidationForFeature(featureId)

    expect(result.summary.blockers).toBeGreaterThanOrEqual(3)
    expect(result.issues.some((issue) => issue.code === 'duplicate_plan_event_name')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'missing_event_trigger')).toBe(true)
  })
})
