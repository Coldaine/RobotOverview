import { describe, it, expect, afterEach, vi } from 'vitest';
import { isHangarAgentEnabled, readAgentModelConfig } from '@/server/beast/model';

describe('agent model env', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires both base URL and model', () => {
    vi.stubEnv('BEAST_AGENT_BASE_URL', '');
    vi.stubEnv('BEAST_AGENT_MODEL', '');
    expect(readAgentModelConfig()).toBeNull();

    vi.stubEnv('BEAST_AGENT_BASE_URL', 'http://core-prime:11434/v1');
    vi.stubEnv('BEAST_AGENT_MODEL', '');
    expect(readAgentModelConfig()).toBeNull();

    vi.stubEnv('BEAST_AGENT_MODEL', 'llama3.2');
    expect(readAgentModelConfig()).toEqual({
      baseURL: 'http://core-prime:11434/v1',
      model: 'llama3.2',
      apiKey: undefined,
    });
  });

  it('gates the hangar agent behind HANGAR_AGENT_ENABLED', () => {
    vi.stubEnv('HANGAR_AGENT_ENABLED', '');
    expect(isHangarAgentEnabled()).toBe(false);
    vi.stubEnv('HANGAR_AGENT_ENABLED', 'true');
    expect(isHangarAgentEnabled()).toBe(true);
  });
});
