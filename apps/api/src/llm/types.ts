import { z } from 'zod';

export const PropertySchema = z.object({
  property_name: z.string(),
  property_type: z.enum(['event', 'user', 'super']),
  data_type: z.enum(['String', 'Int', 'Float', 'Boolean', 'List', 'JSON']),
  is_required: z.boolean(),
  example_value: z.string().nullable(),
  description: z.string().nullable(),
});

export const SuggestedEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string().nullable(),
  reasoning: z.string(),
  duplicate_of_name: z.string().nullable(),
  properties: z.array(PropertySchema),
});

export const GeneratedEventsSchema = z.object({
  events: z.array(SuggestedEventSchema),
});

export type SuggestedEvent = z.infer<typeof SuggestedEventSchema>;
export type GeneratedEvents = z.infer<typeof GeneratedEventsSchema>;
