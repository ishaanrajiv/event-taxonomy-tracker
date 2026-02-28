import { z } from 'zod'

export const validationCodes = {
  duplicate_plan_event_name: 'duplicate_plan_event_name',
  duplicate_property_name_in_event_scope: 'duplicate_property_name_in_event_scope',
  missing_event_name: 'missing_event_name',
  missing_event_trigger: 'missing_event_trigger',
  missing_required_description: 'missing_required_description',
  update_without_catalog_target: 'update_without_catalog_target',
  property_datatype_conflict_with_registry: 'property_datatype_conflict_with_registry',
  publish_conflict_catalog_version_changed: 'publish_conflict_catalog_version_changed',
  unreadable_prd_for_ai: 'unreadable_prd_for_ai',
  zero_mapped_events_for_in_scope_requirements: 'zero_mapped_events_for_in_scope_requirements',
  requirement_partially_covered: 'requirement_partially_covered',
  plan_event_without_requirement: 'plan_event_without_requirement',
  potential_catalog_match_unreviewed: 'potential_catalog_match_unreviewed',
  property_description_missing: 'property_description_missing',
  excessively_similar_property_names: 'excessively_similar_property_names',
  reused_deprecated_catalog_event: 'reused_deprecated_catalog_event',
  warning_acknowledged_not_resolved: 'warning_acknowledged_not_resolved',
  ambiguous_requirement: 'ambiguous_requirement',
  assumed_trigger_not_explicit: 'assumed_trigger_not_explicit',
  likely_missing_properties: 'likely_missing_properties',
  potential_over_instrumentation: 'potential_over_instrumentation',
  suggested_consolidation: 'suggested_consolidation',
} as const

export const ValidationCodeSchema = z.enum(Object.values(validationCodes) as [string, ...string[]])
export type ValidationCode = z.infer<typeof ValidationCodeSchema>

export const ValidationIssueInputSchema = z.object({
  entityType: z.enum(['feature', 'requirement', 'plan_event', 'plan_event_property', 'catalog_event']),
  entityId: z.string(),
  severity: z.enum(['blocker', 'warning', 'info']),
  code: ValidationCodeSchema,
  title: z.string().min(1),
  message: z.string().min(1),
  source: z.enum(['rule', 'ai']),
  isDismissed: z.boolean().default(false),
  dismissedReason: z.string().trim().optional(),
})

export const ValidationSummarySchema = z.object({
  blockers: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  info: z.number().int().nonnegative(),
  dismissed: z.number().int().nonnegative(),
})

export type ValidationIssueInput = z.infer<typeof ValidationIssueInputSchema>
export type ValidationSummary = z.infer<typeof ValidationSummarySchema>
