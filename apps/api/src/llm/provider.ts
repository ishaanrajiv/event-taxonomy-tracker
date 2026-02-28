import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';

type Provider = 'anthropic' | 'openai' | 'google';

interface ProviderConfig {
  name: string;
  envVarName: string;
  getUrl: string;
  defaultModel: string;
  createModel: (modelId: string) => LanguageModel;
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    envVarName: 'ANTHROPIC_API_KEY',
    getUrl: 'https://console.anthropic.com/settings/keys',
    defaultModel: 'claude-sonnet-4-20250514',
    createModel: (modelId) => anthropic(modelId),
  },
  openai: {
    name: 'OpenAI (GPT)',
    envVarName: 'OPENAI_API_KEY',
    getUrl: 'https://platform.openai.com/api-keys',
    defaultModel: 'gpt-4o',
    createModel: (modelId) => openai(modelId),
  },
  google: {
    name: 'Google (Gemini)',
    envVarName: 'GOOGLE_GENERATIVE_AI_API_KEY',
    getUrl: 'https://aistudio.google.com/app/apikey',
    defaultModel: 'gemini-2.0-flash-exp',
    createModel: (modelId) => google(modelId),
  },
};

/**
 * Get the configured LLM model for event generation
 *
 * Environment Variables:
 * - LLM_PROVIDER (optional): 'anthropic' | 'openai' | 'google' (default: 'anthropic')
 * - LLM_MODEL (optional): Model ID override (uses provider default if not set)
 * - ANTHROPIC_API_KEY (required if provider=anthropic)
 * - OPENAI_API_KEY (required if provider=openai)
 * - GOOGLE_GENERATIVE_AI_API_KEY (required if provider=google)
 *
 * @throws {Error} If required API key is not set
 * @returns Language model instance configured for the selected provider
 */
export function getModel(): LanguageModel {
  const providerName = (process.env.LLM_PROVIDER || 'anthropic') as Provider;
  const provider = PROVIDERS[providerName];

  if (!provider) {
    throw new Error(
      `Invalid LLM_PROVIDER: "${providerName}"\n\n` +
      `Supported providers: ${Object.keys(PROVIDERS).join(', ')}\n\n` +
      `Set LLM_PROVIDER in your .env file to one of the supported providers.`
    );
  }

  // Check for API key
  const apiKey = process.env[provider.envVarName];
  if (!apiKey) {
    throw new Error(
      `${provider.envVarName} environment variable is not set.\n\n` +
      `LLM-powered event generation requires an API key for ${provider.name}.\n\n` +
      `Setup instructions:\n` +
      `1. Get your API key from: ${provider.getUrl}\n` +
      `2. Copy apps/api/.env.example to apps/api/.env\n` +
      `3. Add your key: ${provider.envVarName}=...\n` +
      `4. Restart the server\n\n` +
      `Alternative: Use a different provider by setting LLM_PROVIDER in .env\n` +
      `Supported providers: ${Object.keys(PROVIDERS).join(', ')}\n\n` +
      `Note: The app will work without this key, but "Generate from PRD" feature will be disabled.`
    );
  }

  // Use custom model or default
  const modelId = process.env.LLM_MODEL || provider.defaultModel;

  console.log(`[LLM] Using provider: ${providerName}, model: ${modelId}`);

  return provider.createModel(modelId);
}
