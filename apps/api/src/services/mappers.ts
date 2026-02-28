import type {
  AiRun,
  CatalogEvent,
  CatalogEventVersion,
  CatalogProperty,
  Comment,
  CommentThread,
  Feature,
  FeatureRequirement,
  FeatureSource,
  PlanEvent,
  PlanEventProperty,
  PlanEventRequirementLink,
  TrackingPlan,
  TrackingPlanRelease,
  ValidationIssue,
} from '@tracker/contracts'

import { safeParseJson } from '../lib/json.js'

export const mapFeature = (row: {
  id: string
  slug: string
  title: string
  summary: string | null
  productArea: string | null
  ownerName: string | null
  targetRelease: string | null
  workflowStatus: string
  hasUnpublishedChanges: boolean
  lastPublishedReleaseNumber: number | null
  createdAt: string
  updatedAt: string
}): Feature => ({
  ...row,
})

export const mapFeatureSource = (row: {
  id: string
  featureId: string
  sourceType: string
  title: string
  originalFilename: string | null
  mimeType: string | null
  storagePath: string | null
  rawText: string | null
  extractedText: string | null
  externalUrl: string | null
  parseStatus: string
  createdAt: string
}): FeatureSource => ({
  ...row,
})

export const mapFeatureRequirement = (row: {
  id: string
  featureId: string
  sourceId: string | null
  ordinal: number
  title: string
  description: string
  status: string
  sourceExcerpt: string | null
  sourceLocation: string | null
  sourceMethod: string
  aiConfidence: string | null
  createdAt: string
  updatedAt: string
}): FeatureRequirement => ({
  ...row,
  aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : null,
})

export const mapTrackingPlan = (row: {
  id: string
  featureId: string
  summary: string | null
  generationState: string
  lastGeneratedAt: string | null
  createdAt: string
  updatedAt: string
}): TrackingPlan => ({
  ...row,
})

export const mapPlanEvent = (row: {
  id: string
  trackingPlanId: string
  ordinal: number
  name: string | null
  description: string | null
  trigger: string | null
  platformsJson: string
  decisionType: string
  workflowState: string
  linkedCatalogEventId: string | null
  catalogBaseVersionNumber: number | null
  sourceMethod: string
  aiConfidence: string | null
  createdAt: string
  updatedAt: string
}): PlanEvent => ({
  ...row,
  platforms: safeParseJson<string[]>(row.platformsJson, []),
  aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : null,
})

export const mapPlanEventProperty = (row: {
  id: string
  planEventId: string
  ordinal: number
  name: string
  scope: string
  dataType: string
  description: string | null
  required: boolean
  exampleValue: string | null
  allowedValuesJson: string | null
  sourceMethod: string
  aiConfidence: string | null
}): PlanEventProperty => ({
  ...row,
  allowedValuesJson: row.allowedValuesJson ? safeParseJson(row.allowedValuesJson, null) : null,
  aiConfidence: row.aiConfidence ? Number(row.aiConfidence) : null,
})

export const mapPlanEventRequirementLink = (row: {
  id: string
  planEventId: string
  requirementId: string
}): PlanEventRequirementLink => ({
  ...row,
})

export const mapValidationIssue = (row: {
  id: string
  featureId: string
  trackingPlanId: string
  entityType: string
  entityId: string
  severity: string
  code: string
  title: string
  message: string
  source: string
  isDismissed: boolean
  dismissedReason: string | null
  createdAt: string
}): ValidationIssue => ({
  ...row,
})

export const mapCommentThread = (row: {
  id: string
  featureId: string
  entityType: string
  entityId: string
  status: string
  createdAt: string
  updatedAt: string
}): CommentThread => ({
  ...row,
})

export const mapComment = (row: {
  id: string
  threadId: string
  authorName: string
  body: string
  createdAt: string
}): Comment => ({
  ...row,
})

export const mapCatalogEvent = (row: {
  id: string
  name: string
  description: string | null
  trigger: string | null
  platformsJson: string
  status: string
  createdAt: string
  updatedAt: string
  currentVersionNumber: number
}): CatalogEvent => ({
  ...row,
  platforms: safeParseJson<string[]>(row.platformsJson, []),
})

export const mapCatalogProperty = (row: {
  id: string
  name: string
  normalizedName: string
  dataType: string
  description: string | null
  allowedValuesJson: string | null
  createdAt: string
  updatedAt: string
}): CatalogProperty => ({
  ...row,
  allowedValuesJson: row.allowedValuesJson ? safeParseJson(row.allowedValuesJson, null) : null,
})

export const mapCatalogEventVersion = (row: {
  id: string
  catalogEventId: string
  versionNumber: number
  action: string
  snapshotJson: string
  diffJson: string
  sourceFeatureId: string | null
  sourceReleaseId: string | null
  createdAt: string
}): CatalogEventVersion => ({
  ...row,
  snapshotJson: safeParseJson(row.snapshotJson, {}),
  diffJson: safeParseJson(row.diffJson, {}),
})

export const mapTrackingPlanRelease = (row: {
  id: string
  featureId: string | null
  trackingPlanId: string | null
  releaseNumber: number
  summary: string | null
  publishedBy: string
  publishedAt: string
  resultSnapshotJson: string
  resultDiffJson: string
  publishMode: string
}): TrackingPlanRelease => ({
  ...row,
  resultSnapshotJson: safeParseJson(row.resultSnapshotJson, {}),
  resultDiffJson: safeParseJson(row.resultDiffJson, {}),
})

export const mapAiRun = (row: {
  id: string
  featureId: string
  runType: string
  status: string
  startedAt: string
  finishedAt: string | null
  errorMessage: string | null
  inputSnapshotJson: string | null
  outputSnapshotJson: string | null
}): AiRun => ({
  ...row,
  inputSnapshotJson: row.inputSnapshotJson ? safeParseJson(row.inputSnapshotJson, null) : null,
  outputSnapshotJson: row.outputSnapshotJson ? safeParseJson(row.outputSnapshotJson, null) : null,
})
