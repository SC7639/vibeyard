import type { ClaudeOllamaPreferences, Preferences } from '../../shared/types';
import { DEFAULT_CLAUDE_OLLAMA_PREFERENCES } from '../../shared/types';
import { loadState } from '../store';

export function resolveClaudeOllama(prefs: Preferences | undefined): ClaudeOllamaPreferences {
  const o = prefs?.claudeOllama;
  return {
    baseUrl: o?.baseUrl?.trim() || DEFAULT_CLAUDE_OLLAMA_PREFERENCES.baseUrl,
    authToken: o?.authToken ?? DEFAULT_CLAUDE_OLLAMA_PREFERENCES.authToken,
    apiKey: o?.apiKey ?? DEFAULT_CLAUDE_OLLAMA_PREFERENCES.apiKey,
    defaultModel: o?.defaultModel?.trim() || DEFAULT_CLAUDE_OLLAMA_PREFERENCES.defaultModel,
  };
}

/**
 * Env keys passed to the Claude (Ollama) PTY, from persisted preferences.
 */
export function getClaudeOllamaEnvForPty(): Record<string, string> {
  const r = resolveClaudeOllama(loadState().preferences);
  return {
    ANTHROPIC_AUTH_TOKEN: r.authToken,
    ANTHROPIC_API_KEY: r.apiKey,
    ANTHROPIC_BASE_URL: r.baseUrl,
  };
}
