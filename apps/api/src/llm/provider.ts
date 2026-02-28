import { anthropic } from '@ai-sdk/anthropic';

export function getModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY environment variable is required for LLM event generation. ' +
      'Please set it in your environment or .env file.'
    );
  }

  // Use Claude Sonnet 4.5 - fast and cost-effective for event generation
  return anthropic('claude-sonnet-4-20250514', {
    apiKey,
  });
}
