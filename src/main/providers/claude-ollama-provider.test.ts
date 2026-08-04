import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isWin } from '../platform';
import { DEFAULT_CLAUDE_OLLAMA_PREFERENCES, type Preferences } from '../../shared/types';

const { loadState } = vi.hoisted(() => {
  return { loadState: vi.fn(() => ({ preferences: {} as Preferences })) };
});

vi.mock('../pty-manager', () => ({
  getFullPath: vi.fn(() => (isWin ? '/usr/local/bin;/usr/bin' : '/usr/local/bin:/usr/bin')),
}));
vi.mock('../store', () => ({
  loadState,
}));

import { ClaudeOllamaProvider } from './claude-ollama-provider';

describe('ClaudeOllamaProvider', () => {
  let p: ClaudeOllamaProvider;
  beforeEach(() => {
    loadState.mockReturnValue({ preferences: {} });
    p = new ClaudeOllamaProvider();
  });

  it('uses claude-ollama id and display name', () => {
    expect(p.meta.id).toBe('claude-ollama');
    expect(p.meta.displayName).toBe('Claude Code (Ollama)');
  });

  it('merges Ollama API env on top of base claude env using defaults from preferences', () => {
    const env = p.buildEnv('sid', { FOO: '1' });
    expect(env.CLAUDE_IDE_SESSION_ID).toBe('sid');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe(DEFAULT_CLAUDE_OLLAMA_PREFERENCES.authToken);
    expect(env.ANTHROPIC_API_KEY).toBe(DEFAULT_CLAUDE_OLLAMA_PREFERENCES.apiKey);
    expect(env.ANTHROPIC_BASE_URL).toBe(DEFAULT_CLAUDE_OLLAMA_PREFERENCES.baseUrl);
  });

  it('uses persisted claudeOllama preferences', () => {
    loadState.mockReturnValue({
      preferences: {
        claudeOllama: {
          baseUrl: 'http://192.168.1.1:11434',
          authToken: 'x',
          apiKey: 'k',
          defaultModel: 'mymodel',
        },
      },
    });
    p = new ClaudeOllamaProvider();
    const env = p.buildEnv('s', {});
    expect(env.ANTHROPIC_BASE_URL).toBe('http://192.168.1.1:11434');
    expect(env.ANTHROPIC_AUTH_TOKEN).toBe('x');
    expect(env.ANTHROPIC_API_KEY).toBe('k');
    const args = p.buildArgs({ cliSessionId: null, isResume: false, extraArgs: '' });
    expect(args).toEqual(['--model', 'mymodel']);
  });

  it('appends default model when args omit --model', () => {
    const args = p.buildArgs({ cliSessionId: null, isResume: false, extraArgs: '' });
    expect(args).toEqual(['--model', DEFAULT_CLAUDE_OLLAMA_PREFERENCES.defaultModel]);
  });

  it('does not add a second --model when extraArgs sets it', () => {
    const args = p.buildArgs({ cliSessionId: null, isResume: false, extraArgs: '--model glm-4.7-flash' });
    const modelFlags = args.filter((a) => a === '--model');
    expect(modelFlags.length).toBe(1);
    const i = args.indexOf('--model');
    expect(args[i + 1]).toBe('glm-4.7-flash');
  });
});
