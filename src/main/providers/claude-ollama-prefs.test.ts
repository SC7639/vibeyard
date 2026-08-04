import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_CLAUDE_OLLAMA_PREFERENCES, type Preferences } from '../../shared/types';

const { loadState } = vi.hoisted(() => {
  return { loadState: vi.fn(() => ({ preferences: {} as Preferences })) };
});
vi.mock('../store', () => ({ loadState }));

import { getClaudeOllamaEnvForPty, resolveClaudeOllama } from './claude-ollama-prefs';

describe('resolveClaudeOllama', () => {
  it('fills defaults when undefined', () => {
    expect(resolveClaudeOllama(undefined)).toEqual(DEFAULT_CLAUDE_OLLAMA_PREFERENCES);
  });

  it('merges partial preferences', () => {
    expect(
      resolveClaudeOllama({
        claudeOllama: { baseUrl: 'http://a', authToken: 't', apiKey: '', defaultModel: 'm' },
      } as Preferences),
    ).toEqual({ baseUrl: 'http://a', authToken: 't', apiKey: '', defaultModel: 'm' });
  });
});

describe('getClaudeOllamaEnvForPty', () => {
  beforeEach(() => {
    loadState.mockReturnValue({ preferences: {} });
  });

  it('returns ANTHROPIC_* keys from state', () => {
    expect(getClaudeOllamaEnvForPty()).toEqual({
      ANTHROPIC_AUTH_TOKEN: DEFAULT_CLAUDE_OLLAMA_PREFERENCES.authToken,
      ANTHROPIC_API_KEY: DEFAULT_CLAUDE_OLLAMA_PREFERENCES.apiKey,
      ANTHROPIC_BASE_URL: DEFAULT_CLAUDE_OLLAMA_PREFERENCES.baseUrl,
    });
  });
});
