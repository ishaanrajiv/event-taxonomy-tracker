import { z } from 'zod'

export const featureWorkflowStatuses = ['draft', 'in_review', 'ready_to_publish', 'archived'] as const
export const requirementStatuses = ['unmapped', 'partially_mapped', 'mapped', 'out_of_scope'] as const
export const planDecisionTypes = ['new', 'reuse', 'update'] as const
export const planWorkflowStates = ['draft', 'accepted', 'blocked', 'discarded', 'published'] as const
export const validationSeverities = ['blocker', 'warning', 'info'] as const
export const sourceTypes = ['pasted_text', 'uploaded_file', 'external_link', 'note'] as const
export const sourceMethods = ['manual', 'ai'] as const
export const propertyScopes = ['event', 'user', 'global'] as const
export const propertyDataTypes = ['string', 'int', 'float', 'boolean', 'timestamp', 'list', 'json'] as const
export const catalogEventStatuses = ['active', 'deprecated', 'archived'] as const
export const releasePublishModes = ['tracking_plan', 'adhoc'] as const
export const aiRunTypes = [
  'extract_requirements',
  'generate_plan',
  'match_catalog',
  'full_generate',
  'regenerate_event',
] as const
export const aiRunStatuses = ['queued', 'running', 'completed', 'failed'] as const

export const FeatureWorkflowStatusSchema = z.enum(featureWorkflowStatuses)
export const RequirementStatusSchema = z.enum(requirementStatuses)
export const PlanDecisionTypeSchema = z.enum(planDecisionTypes)
export const PlanWorkflowStateSchema = z.enum(planWorkflowStates)
export const ValidationSeveritySchema = z.enum(validationSeverities)
export const SourceTypeSchema = z.enum(sourceTypes)
export const SourceMethodSchema = z.enum(sourceMethods)
export const PropertyScopeSchema = z.enum(propertyScopes)
export const PropertyDataTypeSchema = z.enum(propertyDataTypes)
export const CatalogEventStatusSchema = z.enum(catalogEventStatuses)
export const ReleasePublishModeSchema = z.enum(releasePublishModes)
export const AiRunTypeSchema = z.enum(aiRunTypes)
export const AiRunStatusSchema = z.enum(aiRunStatuses)

export type FeatureWorkflowStatus = z.infer<typeof FeatureWorkflowStatusSchema>
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>
export type PlanDecisionType = z.infer<typeof PlanDecisionTypeSchema>
export type PlanWorkflowState = z.infer<typeof PlanWorkflowStateSchema>
export type ValidationSeverity = z.infer<typeof ValidationSeveritySchema>
export type SourceType = z.infer<typeof SourceTypeSchema>
export type SourceMethod = z.infer<typeof SourceMethodSchema>
export type PropertyScope = z.infer<typeof PropertyScopeSchema>
export type PropertyDataType = z.infer<typeof PropertyDataTypeSchema>
export type CatalogEventStatus = z.infer<typeof CatalogEventStatusSchema>
export type ReleasePublishMode = z.infer<typeof ReleasePublishModeSchema>
export type AiRunType = z.infer<typeof AiRunTypeSchema>
export type AiRunStatus = z.infer<typeof AiRunStatusSchema>
