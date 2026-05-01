import type { BrowserWindow } from 'electron';
import type { CliProviderMeta } from '../../shared/types';
import { ClaudeProvider } from './claude-provider';
import { loadState } from '../store';
import { resolveClaudeOllama } from './claude-ollama-prefs';

const claudeRef = new ClaudeProvider();

/**
 * Same binary and config as Claude Code, with env pointing at Ollama's Anthropic-compatible API.
 * Hooks, status scripts, and cleanup are handled by the primary Claude provider; this id only
 * changes spawn env and default args.
 * @see https://docs.ollama.com/integrations/claude-code
 */
export class ClaudeOllamaProvider extends ClaudeProvider {
  override readonly meta: CliProviderMeta = {
    ...claudeRef.meta,
    id: 'claude-ollama',
    displayName: 'Claude Code (Ollama)',
  };

  override buildEnv(sessionId: string, baseEnv: Record<string, string>): Record<string, string> {
    const env = super.buildEnv(sessionId, baseEnv);
    const o = resolveClaudeOllama(loadState().preferences);
    env.ANTHROPIC_AUTH_TOKEN = o.authToken;
    env.ANTHROPIC_API_KEY = o.apiKey;
    env.ANTHROPIC_BASE_URL = o.baseUrl;
    return env;
  }

  override buildArgs(opts: {
    cliSessionId: string | null;
    isResume: boolean;
    extraArgs: string;
    initialPrompt?: string;
  }): string[] {
    const args = super.buildArgs(opts);
    if (!args.includes('--model')) {
      const model = resolveClaudeOllama(loadState().preferences).defaultModel;
      args.push('--model', model);
    }
    return args;
  }

  override async installHooks(_win?: BrowserWindow | null, _projectPath?: string): Promise<void> {
    // Installed by ClaudeProvider at startup; same binary and ~/.claude config.
  }

  override installStatusScripts(): void {}

  override cleanup(): void {}
}
