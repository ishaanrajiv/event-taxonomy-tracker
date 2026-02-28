import { z } from 'zod'

import { PlanDecisionTypeSchema, PropertyDataTypeSchema, PropertyScopeSchema } from './enums.js'

export const AiRequirementItemSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  sourceExcerpt: z.string().min(1),
  sourceLocation: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const AiExtractRequirementsOutputSchema = z.object({
  requirements: z.array(AiRequirementItemSchema),
})

export const AiPlanPropertyOutputSchema = z.object({
  name: z.string().min(1),
  scope: PropertyScopeSchema,
  dataType: PropertyDataTypeSchema,
  description: z.string().optional(),
  required: z.boolean(),
  exampleValue: z.string().optional(),
  allowedValues: z.array(z.string()).optional(),
  sourceExcerpt: z.string().min(1),
  sourceLocation: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const AiPlanEventOutputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  trigger: z.string().optional(),
  platforms: z.array(z.string()).default([]),
  decisionType: PlanDecisionTypeSchema.default('new'),
  properties: z.array(AiPlanPropertyOutputSchema).default([]),
  requirementIndexes: z.array(z.number().int().nonnegative()).default([]),
  sourceExcerpt: z.string().min(1),
  sourceLocation: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

export const AiGenerateTrackingPlanOutputSchema = z.object({
  summary: z.string().optional(),
  events: z.array(AiPlanEventOutputSchema),
})

export const AiCatalogMatchOutputSchema = z.object({
  matches: z.array(
    z.object({
      planEventName: z.string().min(1),
      decisionType: PlanDecisionTypeSchema,
      catalogEventId: z.string().optional(),
      rationale: z.string().min(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
})

export type AiExtractRequirementsOutput = z.infer<typeof AiExtractRequirementsOutputSchema>
export type AiGenerateTrackingPlanOutput = z.infer<typeof AiGenerateTrackingPlanOutputSchema>
export type AiCatalogMatchOutput = z.infer<typeof AiCatalogMatchOutputSchema>
