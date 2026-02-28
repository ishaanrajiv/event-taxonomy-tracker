import { z } from 'zod'

import {
  AiRunTypeSchema,
  FeatureWorkflowStatusSchema,
  PlanDecisionTypeSchema,
  PlanWorkflowStateSchema,
  PropertyDataTypeSchema,
  PropertyScopeSchema,
  ReleasePublishModeSchema,
  RequirementStatusSchema,
  SourceMethodSchema,
  SourceTypeSchema,
} from './enums.js'
import {
  AiRunSchema,
  CatalogEventSchema,
  CatalogEventVersionSchema,
  CatalogPropertySchema,
  CommentSchema,
  CommentThreadSchema,
  FeatureRequirementSchema,
  FeatureSchema,
  FeatureSourceSchema,
  PlanEventPropertySchema,
  PlanEventRequirementLinkSchema,
  PlanEventSchema,
  TrackingPlanReleaseSchema,
  TrackingPlanSchema,
  ValidationIssueSchema,
} from './entities.js'
import { ValidationSummarySchema } from './validation.js'

export const CreateFeatureRequestSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  summary: z.string().optional(),
  productArea: z.string().optional(),
  ownerName: z.string().optional(),
  targetRelease: z.string().optional(),
  actorName: z.string().min(1),
})

export const UpdateFeatureRequestSchema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  productArea: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  targetRelease: z.string().nullable().optional(),
  workflowStatus: FeatureWorkflowStatusSchema.optional(),
  hasUnpublishedChanges: z.boolean().optional(),
  actorName: z.string().min(1),
})

export const CreateSourceRequestSchema = z.object({
  sourceType: SourceTypeSchema,
  title: z.string().min(1),
  rawText: z.string().optional(),
  externalUrl: z.string().url().optional(),
  actorName: z.string().min(1),
})

export const CreateRequirementRequestSchema = z.object({
  sourceId: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  status: RequirementStatusSchema.default('unmapped'),
  sourceExcerpt: z.string().optional(),
  sourceLocation: z.string().optional(),
  sourceMethod: SourceMethodSchema.default('manual'),
  aiConfidence: z.number().min(0).max(1).optional(),
  actorName: z.string().min(1),
})

export const UpdateRequirementRequestSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: RequirementStatusSchema.optional(),
  sourceExcerpt: z.string().nullable().optional(),
  sourceLocation: z.string().nullable().optional(),
  actorName: z.string().min(1),
})

export const ReorderRequirementsRequestSchema = z.object({
  requirementIds: z.array(z.string().min(1)).min(1),
  actorName: z.string().min(1),
})

export const UpdateTrackingPlanRequestSchema = z.object({
  summary: z.string().nullable().optional(),
  generationState: z.enum(['idle', 'running', 'done', 'failed']).optional(),
  actorName: z.string().min(1),
})

export const PlanEventPropertyInputSchema = PlanEventPropertySchema.pick({
  name: true,
  scope: true,
  dataType: true,
  description: true,
  required: true,
  exampleValue: true,
  allowedValuesJson: true,
}).extend({
  sourceMethod: SourceMethodSchema.default('manual'),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
})

export const CreatePlanEventRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  trigger: z.string().optional(),
  platforms: z.array(z.string()).default([]),
  decisionType: PlanDecisionTypeSchema.default('new'),
  workflowState: PlanWorkflowStateSchema.default('draft'),
  linkedCatalogEventId: z.string().nullable().optional(),
  catalogBaseVersionNumber: z.number().int().nonnegative().nullable().optional(),
  sourceMethod: SourceMethodSchema.default('manual'),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
  properties: z.array(PlanEventPropertyInputSchema).default([]),
  requirementIds: z.array(z.string().min(1)).default([]),
  actorName: z.string().min(1),
})

export const UpdatePlanEventRequestSchema = CreatePlanEventRequestSchema.partial().extend({
  actorName: z.string().min(1),
})

export const ReorderPlanEventsRequestSchema = z.object({
  planEventIds: z.array(z.string().min(1)).min(1),
  actorName: z.string().min(1),
})

export const LinkPlanRequirementRequestSchema = z.object({
  requirementId: z.string().min(1),
  actorName: z.string().min(1),
})

export const CreateThreadRequestSchema = z.object({
  entityType: z.enum(['feature', 'requirement', 'plan_event', 'validation_issue']),
  entityId: z.string().min(1),
  initialComment: z.string().min(1),
  actorName: z.string().min(1),
})

export const CreateCommentRequestSchema = z.object({
  body: z.string().min(1),
  actorName: z.string().min(1),
})

export const UpdateThreadRequestSchema = z.object({
  status: z.enum(['open', 'resolved']),
  actorName: z.string().min(1),
})

export const CreateAiRunRequestSchema = z.object({
  runType: AiRunTypeSchema,
  input: z.record(z.string(), z.unknown()).optional(),
  actorName: z.string().min(1),
})

export const PublishFeatureRequestSchema = z.object({
  summary: z.string().optional(),
  warningAcknowledgement: z.string().optional(),
  actorName: z.string().min(1),
})

export const UpsertCatalogEventRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().optional(),
  platforms: z.array(z.string()).default([]),
  status: z.enum(['active', 'deprecated', 'archived']).default('active'),
  baseVersionNumber: z.number().int().nonnegative().optional(),
  properties: z
    .array(
      z.object({
        name: z.string().min(1),
        dataType: PropertyDataTypeSchema,
        description: z.string().optional(),
        scope: PropertyScopeSchema,
        required: z.boolean().default(false),
        exampleValue: z.string().optional(),
        allowedValuesJson: z.unknown().optional(),
      }),
    )
    .default([]),
  actorName: z.string().min(1),
  publishMode: ReleasePublishModeSchema.default('adhoc'),
  featureId: z.string().optional(),
})

export const FeatureWithPlanSchema = z.object({
  feature: FeatureSchema,
  trackingPlan: TrackingPlanSchema,
})

export const TrackingPlanDetailSchema = z.object({
  trackingPlan: TrackingPlanSchema,
  events: z.array(PlanEventSchema),
  properties: z.array(PlanEventPropertySchema),
  requirementLinks: z.array(PlanEventRequirementLinkSchema),
})

export const FeatureCommentsResponseSchema = z.object({
  threads: z.array(CommentThreadSchema),
  comments: z.array(CommentSchema),
})

export const ValidationResponseSchema = z.object({
  issues: z.array(ValidationIssueSchema),
  summary: ValidationSummarySchema,
})

export const CatalogEventDetailSchema = z.object({
  event: CatalogEventSchema,
  properties: z.array(
    z.object({
      property: CatalogPropertySchema,
      scope: PropertyScopeSchema,
      required: z.boolean(),
      exampleValue: z.string().nullable(),
      notes: z.string().nullable(),
    }),
  ),
})

export const ReleaseDetailSchema = z.object({
  release: TrackingPlanReleaseSchema,
  versions: z.array(CatalogEventVersionSchema),
})

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
  aiEnabled: z.boolean(),
})

export const SearchCatalogResponseSchema = z.object({
  events: z.array(CatalogEventSchema),
  properties: z.array(CatalogPropertySchema),
})

export const ApiListFeaturesResponseSchema = z.array(FeatureSchema)
export const ApiGetFeatureResponseSchema = FeatureWithPlanSchema
export const ApiGetSourcesResponseSchema = z.array(FeatureSourceSchema)
export const ApiGetRequirementsResponseSchema = z.array(FeatureRequirementSchema)
export const ApiGetTrackingPlanResponseSchema = TrackingPlanDetailSchema
export const ApiGetValidationResponseSchema = ValidationResponseSchema
export const ApiGetFeatureCommentsResponseSchema = FeatureCommentsResponseSchema
export const ApiGetAiRunResponseSchema = AiRunSchema
export const ApiGetFeatureReleasesResponseSchema = z.array(TrackingPlanReleaseSchema)
export const ApiGetReleaseResponseSchema = ReleaseDetailSchema
export const ApiListCatalogEventsResponseSchema = z.array(CatalogEventSchema)
export const ApiGetCatalogEventResponseSchema = CatalogEventDetailSchema
export const ApiListCatalogEventVersionsResponseSchema = z.array(CatalogEventVersionSchema)
export const ApiListCatalogPropertiesResponseSchema = z.array(CatalogPropertySchema)

export type CreateFeatureRequest = z.infer<typeof CreateFeatureRequestSchema>
export type UpdateFeatureRequest = z.infer<typeof UpdateFeatureRequestSchema>
export type CreateSourceRequest = z.infer<typeof CreateSourceRequestSchema>
export type CreateRequirementRequest = z.infer<typeof CreateRequirementRequestSchema>
export type UpdateRequirementRequest = z.infer<typeof UpdateRequirementRequestSchema>
export type ReorderRequirementsRequest = z.infer<typeof ReorderRequirementsRequestSchema>
export type UpdateTrackingPlanRequest = z.infer<typeof UpdateTrackingPlanRequestSchema>
export type CreatePlanEventRequest = z.infer<typeof CreatePlanEventRequestSchema>
export type UpdatePlanEventRequest = z.infer<typeof UpdatePlanEventRequestSchema>
export type ReorderPlanEventsRequest = z.infer<typeof ReorderPlanEventsRequestSchema>
export type LinkPlanRequirementRequest = z.infer<typeof LinkPlanRequirementRequestSchema>
export type CreateThreadRequest = z.infer<typeof CreateThreadRequestSchema>
export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>
export type UpdateThreadRequest = z.infer<typeof UpdateThreadRequestSchema>
export type CreateAiRunRequest = z.infer<typeof CreateAiRunRequestSchema>
export type PublishFeatureRequest = z.infer<typeof PublishFeatureRequestSchema>
export type UpsertCatalogEventRequest = z.infer<typeof UpsertCatalogEventRequestSchema>
