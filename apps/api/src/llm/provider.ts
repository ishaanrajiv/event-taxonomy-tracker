import { gateway } from '@ai-sdk/gateway';
import type { LanguageModel } from 'ai';

const DEFAULT_MODEL = 'openai/gpt-5-nano';

/**
 * Get the configured LLM model for event generation via Vercel AI Gateway.
 *
 * Environment Variables:
 * - AI_GATEWAY_API_KEY (required): Vercel API key for the AI Gateway
 * - LLM_MODEL (optional): Model identifier in "provider:model" format
 *   (default: anthropic:claude-sonnet-4-20250514)
 *
 * @throws {Error} If AI_GATEWAY_API_KEY is not set
 * @returns Language model instance configured via Vercel AI Gateway
 */
export function getModel(): LanguageModel {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      `AI_GATEWAY_API_KEY environment variable is not set.\n\n` +
      `LLM-powered event generation requires a Vercel API key.\n\n` +
      `Setup instructions:\n` +
      `1. Get your API key from: https://vercel.com/account/api-tokens\n` +
      `2. Copy .env.example to .env\n` +
      `3. Add your key: AI_GATEWAY_API_KEY=...\n` +
      `4. Restart the server\n\n` +
      `Note: The app will work without this key, but "Generate from PRD" feature will be disabled.`
    );
  }

  const modelId = process.env.LLM_MODEL || DEFAULT_MODEL;

  console.log(`[LLM] Using model: ${modelId}`);

  return gateway(modelId);
}
