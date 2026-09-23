// Remote terminal pane — xterm.js instance with no backing PTY,
// receiving data from a WebRTC data channel (P2P session sharing).

import { Terminal } from '@xterm/xterm';
import { getTerminalTheme } from '../terminal-theme.js';
import { FitAddon } from '@xterm/addon-fit';
import type { ShareMode } from '../../shared/sharing-types.js';
import { appState } from '../state.js';
import { attachCopyOnSelect, loadWebglWithFallback } from './terminal-utils.js';
import type { WebglAddon } from '@xterm/addon-webgl';
import type { Preferences } from '../../shared/types.js';
import { backdropIsActive, getTerminalSurfaceBackgroundColor } from '../terminal-background-helpers.js';

interface RemoteTerminalInstance {
  terminal: Terminal;
  /** Tracked so the backdrop can dispose it (WebGL can't render a transparent surface). */
  webglAddon?: WebglAddon | null;
  fitAddon: FitAddon;
  element: HTMLDivElement;
  sessionId: string;
  mode: ShareMode;
}

const instances = new Map<string, RemoteTerminalInstance>();

export function createRemoteTerminalPane(
  sessionId: string,
  mode: ShareMode,
  cols: number,
  rows: number,
  onInput: (data: string) => void,
): RemoteTerminalInstance {
  if (instances.has(sessionId)) {
    return instances.get(sessionId)!;
  }

  const element = document.createElement('div');
  element.className = 'terminal-pane hidden';
  element.dataset.sessionId = sessionId;

  const xtermWrap = document.createElement('div');
  xtermWrap.className = 'xterm-wrap';
  element.appendChild(xtermWrap);

  // Status bar showing remote session info
  const statusBar = document.createElement('div');
  statusBar.className = 'session-status-bar remote-status-bar';
  const modeLabel = document.createElement('div');
  modeLabel.className = 'remote-mode-label';
  modeLabel.textContent = `Remote \u00b7 ${mode === 'readonly' ? 'Read-only' : 'Read-write'}`;
  const disconnectBtn = document.createElement('button');
  disconnectBtn.className = 'remote-disconnect-btn';
  disconnectBtn.textContent = 'Disconnect';
  disconnectBtn.addEventListener('click', () => {
    // Import dynamically to avoid circular dependency
    import('../sharing/share-manager.js').then(({ disconnectRemoteSession }) => {
      disconnectRemoteSession(sessionId);
    });
  });
  statusBar.appendChild(modeLabel);
  statusBar.appendChild(disconnectBtn);
  element.appendChild(statusBar);

  const baseTheme = getTerminalTheme(appState.preferences.theme ?? 'dark');
  const terminal = new Terminal({
    theme: backdropIsActive(appState.preferences)
      ? { ...baseTheme, background: getTerminalSurfaceBackgroundColor(appState.preferences) }
      : baseTheme,
    fontSize: 14,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, monospace",
    cursorBlink: mode === 'readwrite',
    allowTransparency: true,
    allowProposedApi: true,
    disableStdin: mode === 'readonly',
    cols,
    rows,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // Handle user input — only in readwrite mode
  if (mode === 'readwrite') {
    terminal.onData((data) => {
      onInput(data);
    });
  }

  const instance: RemoteTerminalInstance = {
    terminal,
    fitAddon,
    element,
    sessionId,
    mode,
  };

  instances.set(sessionId, instance);
  return instance;
}

export function getRemoteTerminalInstance(sessionId: string): RemoteTerminalInstance | undefined {
  return instances.get(sessionId);
}

/** Idempotent — see `attachToContainer` in `terminal-pane.ts` for why that matters. */
export function attachRemoteToContainer(sessionId: string, container: HTMLElement): void {
  const instance = instances.get(sessionId);
  if (!instance) return;

  const xtermWrap = instance.element.querySelector('.xterm-wrap')!;
  if (!xtermWrap.querySelector('.xterm')) {
    container.appendChild(instance.element);
    instance.terminal.open(xtermWrap as HTMLElement);
    attachCopyOnSelect(instance.terminal);

    // WebGL paints opaque cell backgrounds, which would hide the backdrop.
    instance.webglAddon = backdropIsActive(appState.preferences) ? null : loadWebglWithFallback(instance.terminal);
  } else if (instance.element.parentElement !== container) {
    container.appendChild(instance.element);
  }
}

export function showRemotePane(sessionId: string, split: boolean): void {
  const instance = instances.get(sessionId);
  if (!instance) return;
  instance.element.classList.remove('hidden');
  if (split) {
    instance.element.classList.add('split');
  } else {
    instance.element.classList.remove('split');
  }
}

export function hideRemotePane(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (!instance) return;
  instance.element.classList.add('hidden');
}

export function hideAllRemotePanes(): void {
  for (const [, instance] of instances) {
    instance.element.classList.add('hidden');
    instance.element.classList.remove('swarm-dimmed', 'swarm-unread');
  }
}

export function fitRemoteTerminal(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (!instance || instance.element.classList.contains('hidden')) return;

  try {
    instance.fitAddon.fit();
  } catch {
    // Element not yet visible
  }
}

export function writeRemoteData(sessionId: string, data: string): void {
  const instance = instances.get(sessionId);
  if (instance) {
    instance.terminal.write(data);
  }
}

export function showRemoteEndOverlay(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (!instance) return;

  // Don't add duplicate overlays
  if (instance.element.querySelector('.terminal-exit-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'terminal-exit-overlay';
  overlay.innerHTML = `
    <div class="exit-message">
      <span>Remote session ended</span>
    </div>
  `;
  instance.element.appendChild(overlay);
}

/** Set every remote terminal's background (translucent when a backdrop is active). */
export function applyRemoteTerminalsSurface(background: string): void {
  for (const [, inst] of instances) {
    inst.terminal.options.theme = { ...inst.terminal.options.theme, background };
  }
}

/** Enable WebGL when no backdrop is active; dispose it when one is (WebGL renders opaque). */
export function syncRemoteTerminalsWebglFromPreferences(prefs: Preferences): void {
  const useWebgl = !backdropIsActive(prefs);
  for (const [, instance] of instances) {
    if (!instance.terminal.element) continue;
    if (useWebgl) {
      if (!instance.webglAddon) {
        instance.webglAddon = loadWebglWithFallback(instance.terminal);
      }
    } else if (instance.webglAddon) {
      instance.webglAddon.dispose();
      instance.webglAddon = null;
    }
  }
}

export function applyThemeToAllRemoteTerminals(theme: 'dark' | 'light'): void {
  const termTheme = getTerminalTheme(theme);
  for (const instance of instances.values()) {
    instance.terminal.options.theme = termTheme;
  }
}

export function destroyRemoteTerminal(sessionId: string): void {
  const instance = instances.get(sessionId);
  if (!instance) return;

  instance.terminal.dispose();
  instance.element.remove();
  instances.delete(sessionId);
}

export function _resetForTesting(): void {
  for (const [sessionId] of instances) {
    destroyRemoteTerminal(sessionId);
  }
  instances.clear();
}
