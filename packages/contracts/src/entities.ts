import { z } from 'zod'

import {
  AiRunStatusSchema,
  AiRunTypeSchema,
  CatalogEventStatusSchema,
  FeatureWorkflowStatusSchema,
  PlanDecisionTypeSchema,
  PlanWorkflowStateSchema,
  PropertyDataTypeSchema,
  PropertyScopeSchema,
  ReleasePublishModeSchema,
  RequirementStatusSchema,
  SourceMethodSchema,
  SourceTypeSchema,
  ValidationSeveritySchema,
} from './enums.js'
import { ValidationCodeSchema } from './validation.js'

export const DateTimeSchema = z.string().min(1)
export const IdSchema = z.string().min(1)

const JsonSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonSchema), z.record(z.string(), JsonSchema)]),
)

export const FeatureSchema = z.object({
  id: IdSchema,
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().nullable(),
  productArea: z.string().nullable(),
  ownerName: z.string().nullable(),
  targetRelease: z.string().nullable(),
  workflowStatus: FeatureWorkflowStatusSchema,
  hasUnpublishedChanges: z.boolean(),
  lastPublishedReleaseNumber: z.number().int().nonnegative().nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const FeatureSourceSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  sourceType: SourceTypeSchema,
  title: z.string().min(1),
  originalFilename: z.string().nullable(),
  mimeType: z.string().nullable(),
  storagePath: z.string().nullable(),
  rawText: z.string().nullable(),
  extractedText: z.string().nullable(),
  externalUrl: z.string().nullable(),
  parseStatus: z.enum(['pending', 'parsed', 'failed']),
  createdAt: DateTimeSchema,
})

export const FeatureRequirementSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  sourceId: IdSchema.nullable(),
  ordinal: z.number().int().nonnegative(),
  title: z.string().min(1),
  description: z.string().min(1),
  status: RequirementStatusSchema,
  sourceExcerpt: z.string().nullable(),
  sourceLocation: z.string().nullable(),
  sourceMethod: SourceMethodSchema,
  aiConfidence: z.number().min(0).max(1).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const TrackingPlanSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  summary: z.string().nullable(),
  generationState: z.enum(['idle', 'running', 'done', 'failed']),
  lastGeneratedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const PlanEventSchema = z.object({
  id: IdSchema,
  trackingPlanId: IdSchema,
  ordinal: z.number().int().nonnegative(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  trigger: z.string().nullable(),
  platforms: z.array(z.string()),
  decisionType: PlanDecisionTypeSchema,
  workflowState: PlanWorkflowStateSchema,
  linkedCatalogEventId: IdSchema.nullable(),
  catalogBaseVersionNumber: z.number().int().nonnegative().nullable(),
  sourceMethod: SourceMethodSchema,
  aiConfidence: z.number().min(0).max(1).nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const PlanEventPropertySchema = z.object({
  id: IdSchema,
  planEventId: IdSchema,
  ordinal: z.number().int().nonnegative(),
  name: z.string().min(1),
  scope: PropertyScopeSchema,
  dataType: PropertyDataTypeSchema,
  description: z.string().nullable(),
  required: z.boolean(),
  exampleValue: z.string().nullable(),
  allowedValuesJson: JsonSchema.nullable(),
  sourceMethod: SourceMethodSchema,
  aiConfidence: z.number().min(0).max(1).nullable(),
})

export const PlanEventRequirementLinkSchema = z.object({
  id: IdSchema,
  planEventId: IdSchema,
  requirementId: IdSchema,
})

export const ValidationIssueSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  trackingPlanId: IdSchema,
  entityType: z.string().min(1),
  entityId: IdSchema,
  severity: ValidationSeveritySchema,
  code: ValidationCodeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  source: z.enum(['rule', 'ai']),
  isDismissed: z.boolean(),
  dismissedReason: z.string().nullable(),
  createdAt: DateTimeSchema,
})

export const CommentThreadSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  entityType: z.string().min(1),
  entityId: IdSchema,
  status: z.enum(['open', 'resolved']),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const CommentSchema = z.object({
  id: IdSchema,
  threadId: IdSchema,
  authorName: z.string().min(1),
  body: z.string().min(1),
  createdAt: DateTimeSchema,
})

export const CatalogEventSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  trigger: z.string().nullable(),
  platforms: z.array(z.string()),
  status: CatalogEventStatusSchema,
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  currentVersionNumber: z.number().int().nonnegative(),
})

export const CatalogEventPropertySchema = z.object({
  id: IdSchema,
  catalogEventId: IdSchema,
  propertyId: IdSchema,
  scope: PropertyScopeSchema,
  required: z.boolean(),
  exampleValue: z.string().nullable(),
  notes: z.string().nullable(),
})

export const CatalogPropertySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  normalizedName: z.string().min(1),
  dataType: PropertyDataTypeSchema,
  description: z.string().nullable(),
  allowedValuesJson: JsonSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
})

export const CatalogEventVersionSchema = z.object({
  id: IdSchema,
  catalogEventId: IdSchema,
  versionNumber: z.number().int().nonnegative(),
  action: z.enum(['create', 'update', 'archive', 'restore']),
  snapshotJson: JsonSchema,
  diffJson: JsonSchema,
  sourceFeatureId: IdSchema.nullable(),
  sourceReleaseId: IdSchema.nullable(),
  createdAt: DateTimeSchema,
})

export const TrackingPlanReleaseSchema = z.object({
  id: IdSchema,
  featureId: IdSchema.nullable(),
  trackingPlanId: IdSchema.nullable(),
  releaseNumber: z.number().int().positive(),
  summary: z.string().nullable(),
  publishedBy: z.string().min(1),
  publishedAt: DateTimeSchema,
  resultSnapshotJson: JsonSchema,
  resultDiffJson: JsonSchema,
  publishMode: ReleasePublishModeSchema,
})

export const AiRunSchema = z.object({
  id: IdSchema,
  featureId: IdSchema,
  runType: AiRunTypeSchema,
  status: AiRunStatusSchema,
  startedAt: DateTimeSchema,
  finishedAt: DateTimeSchema.nullable(),
  errorMessage: z.string().nullable(),
  inputSnapshotJson: JsonSchema.nullable(),
  outputSnapshotJson: JsonSchema.nullable(),
})

export type Feature = z.infer<typeof FeatureSchema>
export type FeatureSource = z.infer<typeof FeatureSourceSchema>
export type FeatureRequirement = z.infer<typeof FeatureRequirementSchema>
export type TrackingPlan = z.infer<typeof TrackingPlanSchema>
export type PlanEvent = z.infer<typeof PlanEventSchema>
export type PlanEventProperty = z.infer<typeof PlanEventPropertySchema>
export type PlanEventRequirementLink = z.infer<typeof PlanEventRequirementLinkSchema>
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>
export type CommentThread = z.infer<typeof CommentThreadSchema>
export type Comment = z.infer<typeof CommentSchema>
export type CatalogEvent = z.infer<typeof CatalogEventSchema>
export type CatalogEventProperty = z.infer<typeof CatalogEventPropertySchema>
export type CatalogProperty = z.infer<typeof CatalogPropertySchema>
export type CatalogEventVersion = z.infer<typeof CatalogEventVersionSchema>
export type TrackingPlanRelease = z.infer<typeof TrackingPlanReleaseSchema>
export type AiRun = z.infer<typeof AiRunSchema>
