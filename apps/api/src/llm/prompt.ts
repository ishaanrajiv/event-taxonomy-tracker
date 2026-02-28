import { readFileSync } from 'fs';
import { join } from 'path';

interface PromptContext {
  prdContent: string;
  planTitle: string;
  existingEvents: Array<{
    id: number;
    name: string;
    description: string | null;
    category: string | null;
  }>;
  existingProperties: Array<{
    name: string;
    data_type: string;
  }>;
  exampleEvents: Array<{
    name: string;
    description: string | null;
    category: string | null;
    properties: Array<{
      property_name: string;
      property_type: string;
      data_type: string;
      is_required: boolean;
    }>;
  }>;
}

function loadGuidelines(): string {
  const guidelinesPath = join(__dirname, 'guidelines.md');
  return readFileSync(guidelinesPath, 'utf-8');
}

export function buildGenerationPrompt(context: PromptContext): string {
  const guidelines = loadGuidelines();

  const existingEventsList = context.existingEvents.length > 0
    ? context.existingEvents
        .map((e) => `- "${e.name}" (${e.category || 'uncategorized'}): ${e.description || 'no description'}`)
        .join('\n')
    : '(none yet)';

  const existingPropertiesList = context.existingProperties.length > 0
    ? context.existingProperties
        .map((p) => `- ${p.name} (${p.data_type})`)
        .join('\n')
    : '(none yet)';

  const exampleEventsList = context.exampleEvents.length > 0
    ? context.exampleEvents
        .map((e) => {
          const props = e.properties.length > 0
            ? e.properties
                .map((p) => `    - ${p.property_name} (${p.property_type}, ${p.data_type}${p.is_required ? ', required' : ''})`)
                .join('\n')
            : '    (no properties)';
          return `- "${e.name}" (${e.category || 'uncategorized'})\n  Description: ${e.description || 'no description'}\n  Properties:\n${props}`;
        })
        .join('\n\n')
    : '(none available)';

  return `You are an analytics engineering assistant. Your job is to read a Product Requirements Document (PRD) and generate a comprehensive set of analytics tracking events.

## Context
This is for a tracking plan titled: "${context.planTitle}"

${guidelines}

## Existing Events in the Catalog (for duplicate detection)
${existingEventsList}

## Existing Properties in the Registry (reuse when possible)
${existingPropertiesList}

## Example Events (for reference on structure and quality)
Below are some real events from the catalog to give you context on how events are typically structured:

${exampleEventsList}

## PRD Content
${context.prdContent}

## Instructions
1. Read the PRD carefully and identify all user interactions and system events that should be tracked
2. For each event, define its properties with appropriate types and data types
3. Follow the guidelines above for naming, property types, and data types
4. If an existing event already covers a user action, flag it as a potential duplicate by setting duplicate_of_name to the exact event name
5. Include a brief "reasoning" explaining why this event is needed based on the PRD
6. Be thorough but avoid redundant events
7. Think about the user journey and what data would be valuable for analytics
8. Study the example events above to understand the expected quality and structure

## Output Format
Return a JSON object with an "events" array. Each event should have:
{
  "name": "Title Case Event Name",
  "description": "Clear description of when this event fires and what it tracks",
  "category": "Category name or null",
  "reasoning": "Why this event is needed based on the PRD requirements",
  "duplicate_of_name": "Exact Event Name" or null (if this seems like a duplicate of an existing event),
  "properties": [
    {
      "property_name": "Title Case Property Name",
      "property_type": "event" | "user" | "super",
      "data_type": "String" | "Int" | "Float" | "Boolean" | "List" | "JSON",
      "is_required": true | false,
      "example_value": "example value" or null,
      "description": "What this property represents"
    }
  ]
}

Return ONLY the JSON object, no other text.`;
}
