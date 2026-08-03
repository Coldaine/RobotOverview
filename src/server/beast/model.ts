import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

export type BeastAgentModelConfig = {
  baseURL: string;
  model: string;
  apiKey?: string;
};

/** Read planner endpoint env. Empty baseURL/model → agent chat cannot run. */
export function readAgentModelConfig(
  env: NodeJS.ProcessEnv = process.env,
): BeastAgentModelConfig | null {
  const baseURL = env.BEAST_AGENT_BASE_URL?.trim();
  const model = env.BEAST_AGENT_MODEL?.trim();
  if (!baseURL || !model) return null;
  const apiKey = env.BEAST_AGENT_API_KEY?.trim() || undefined;
  return { baseURL, model, apiKey };
}

export function createBeastAgentModel(config: BeastAgentModelConfig): LanguageModel {
  const provider = createOpenAICompatible({
    name: 'beast-ollama',
    baseURL: config.baseURL,
    apiKey: config.apiKey ?? 'ollama',
  });
  return provider.chatModel(config.model);
}

export function isHangarAgentEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HANGAR_AGENT_ENABLED === 'true' || env.HANGAR_AGENT_ENABLED === '1';
}
