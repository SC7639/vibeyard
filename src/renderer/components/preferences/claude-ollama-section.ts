import { appState } from '../../state.js';
import { DEFAULT_CLAUDE_OLLAMA_PREFERENCES, type ClaudeOllamaPreferences } from '../../../shared/types.js';
import type { PreferencesContext, SectionController } from './section.js';

/**
 * Preferences → Claude (Ollama). Points the Anthropic-compatible API at an
 * Ollama host via ANTHROPIC_* env; the provider itself lives in the main process
 * (claude-ollama-provider.ts). Field labels are the literal env var names, so
 * they are intentionally not translated.
 */
export function createClaudeOllamaSection(_ctx: PreferencesContext): SectionController {
  let baseUrl: HTMLInputElement | null = null;
  let authToken: HTMLInputElement | null = null;
  let apiKey: HTMLInputElement | null = null;
  let model: HTMLInputElement | null = null;

  function addTextField(
    container: HTMLElement,
    id: string,
    labelText: string,
    value: string,
    placeholder: string,
    setRef: (el: HTMLInputElement) => void,
  ): void {
    const row = document.createElement('div');
    row.className = 'modal-field';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = placeholder;
    row.appendChild(label);
    row.appendChild(input);
    container.appendChild(row);
    setRef(input);
  }

  return {
    render(container) {
      const co: ClaudeOllamaPreferences = {
        ...DEFAULT_CLAUDE_OLLAMA_PREFERENCES,
        ...appState.preferences.claudeOllama,
      };

      const intro = document.createElement('p');
      intro.className = 'pref-claude-ollama-intro';
      intro.appendChild(
        document.createTextNode(
          'Set ANTHROPIC_BASE_URL to your Ollama host (e.g. another machine). Default model is free text for remote tags. See ',
        ),
      );
      const docLink = document.createElement('a');
      docLink.href = 'https://docs.ollama.com/integrations/claude-code';
      docLink.target = '_blank';
      docLink.rel = 'noopener noreferrer';
      docLink.textContent = "Ollama's documentation";
      intro.appendChild(docLink);
      intro.appendChild(document.createTextNode(' for context length and web search options.'));
      container.appendChild(intro);

      addTextField(container, 'pref-claude-ollama-base', 'ANTHROPIC_BASE_URL', co.baseUrl, 'http://localhost:11434', (el) => {
        baseUrl = el;
      });
      addTextField(container, 'pref-claude-ollama-token', 'ANTHROPIC_AUTH_TOKEN', co.authToken, 'ollama', (el) => {
        authToken = el;
      });
      addTextField(container, 'pref-claude-ollama-key', 'ANTHROPIC_API_KEY', co.apiKey, 'Leave empty for local', (el) => {
        apiKey = el;
      });
      addTextField(
        container,
        'pref-claude-ollama-model',
        'Default model (when args omit --model)',
        co.defaultModel,
        'e.g. qwen3.6:35b-a3b (remote or local Ollama)',
        (el) => {
          model = el;
        },
      );
    },

    save() {
      if (baseUrl && authToken && apiKey && model) {
        appState.setPreference('claudeOllama', {
          baseUrl: baseUrl.value.trim() || DEFAULT_CLAUDE_OLLAMA_PREFERENCES.baseUrl,
          authToken: authToken.value,
          apiKey: apiKey.value,
          defaultModel: model.value.trim() || DEFAULT_CLAUDE_OLLAMA_PREFERENCES.defaultModel,
        });
      }
    },
  };
}
