import { generateObject } from 'ai';
import { getModel } from './provider';
import { buildGenerationPrompt } from './prompt';
import { GeneratedEventsSchema, type SuggestedEvent } from './types';
import type { Database } from 'bun:sqlite';

interface GenerateEventsInput {
  db: Database;
  planId: number;
  planTitle: string;
  prdContent: string;
}

interface GenerateEventsResult {
  events: SuggestedEvent[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function generateEventsFromPrd(
  input: GenerateEventsInput,
): Promise<GenerateEventsResult> {
  // Fetch existing published events for context
  const existingEvents = input.db
    .query(
      `SELECT id, name, description, category
       FROM events
       WHERE is_published = 1
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .all() as Array<{
    id: number;
    name: string;
    description: string | null;
    category: string | null;
  }>;

  // Fetch property registry for reuse
  const existingProperties = input.db
    .query(
      `SELECT DISTINCT name, data_type
       FROM properties
       ORDER BY name ASC`,
    )
    .all() as Array<{
    name: string;
    data_type: string;
  }>;

  // Fetch 10 random example events with their properties for broader context
  const exampleEvents = input.db
    .query(
      `SELECT id, name, description, category
       FROM events
       WHERE is_published = 1
       ORDER BY RANDOM()
       LIMIT 10`,
    )
    .all() as Array<{
    id: number;
    name: string;
    description: string | null;
    category: string | null;
  }>;

  // Fetch properties for each example event
  const exampleEventsWithProps = exampleEvents.map((event) => {
    const properties = input.db
      .query(
        `SELECT ep.property_name, ep.property_type, ep.data_type, ep.is_required
         FROM event_properties ep
         WHERE ep.event_id = ?
         ORDER BY ep.property_name ASC
         LIMIT 20`,
      )
      .all(event.id) as Array<{
      property_name: string;
      property_type: string;
      data_type: string;
      is_required: boolean;
    }>;

    return {
      name: event.name,
      description: event.description,
      category: event.category,
      properties,
    };
  });

  // Build the prompt
  const prompt = buildGenerationPrompt({
    prdContent: input.prdContent,
    planTitle: input.planTitle,
    existingEvents,
    existingProperties,
    exampleEvents: exampleEventsWithProps,
  });

  // Generate structured output using Vercel AI SDK
  const model = getModel();

  const result = await generateObject({
    model,
    schema: GeneratedEventsSchema,
    prompt,
  });

  // Match duplicate_of_name to actual event IDs
  const eventNameToId = new Map(
    existingEvents.map((e) => [e.name.toLowerCase(), e.id]),
  );

  const eventsWithDuplicateIds = result.object.events.map((event) => {
    const duplicateId =
      event.duplicate_of_name && eventNameToId.get(event.duplicate_of_name.toLowerCase());

    return {
      ...event,
      duplicate_of_id: duplicateId || null,
    };
  });

  return {
    events: eventsWithDuplicateIds,
    usage: {
      promptTokens: (result.usage as any).promptTokens || result.usage.totalTokens || 0,
      completionTokens: (result.usage as any).completionTokens || 0,
      totalTokens: result.usage.totalTokens || 0,
    },
  };
}
