import { appState } from './state.js';
import { getFocusedSessionId, getTerminalInstance } from './components/terminal-pane.js';
import { getProviderCapabilities } from './provider-availability.js';
import { showAlertBanner } from './components/alert-banner.js';
import type { ProviderId } from './types.js';

/**
 * Directory Warp should open: focused PTY cwd (including worktree), else session paths, else project root.
 * Requires Warp on the **host** OS. On WSL, the main process converts paths with `wslpath -w` and opens
 * `warp://` via Windows (`cmd.exe /c start`) so the Windows-registered handler runs.
 */
function resolveDirectoryForWarp(): string | null {
  const project = appState.activeProject;
  if (!project) return null;

  const focused = getFocusedSessionId();
  if (focused) {
    const term = getTerminalInstance(focused);
    if (term) return term.projectPath;
  }

  const session = appState.activeSession;
  if (session?.worktreePath) return session.worktreePath;
  if (session?.cwdPath) return session.cwdPath;
  return project.path;
}

/** Shell snippet to resume the current CLI session (matches provider PTY args). Warp has no URI for session id. */
function buildCliResumePasteCommand(providerId: ProviderId, cliSessionId: string): string {
  const q = (s: string) => (/[^\w@._+-]/.test(s) ? `'${s.replace(/'/g, "'\\''")}'` : s);
  const id = q(cliSessionId);
  switch (providerId) {
    case 'claude':
      return `claude -r ${id}`;
    case 'codex':
      return `codex resume ${id}`;
    case 'gemini':
      return `gemini -r ${id}`;
    default:
      return `claude -r ${id}`;
  }
}

function resolveSessionForWarp(): { providerId: ProviderId; cliSessionId: string | null } {
  const project = appState.activeProject;
  const focusedId = getFocusedSessionId();
  const sessionId = focusedId ?? appState.activeSession?.id;
  const session = sessionId && project ? project.sessions.find((s) => s.id === sessionId) : appState.activeSession;
  const term = focusedId ? getTerminalInstance(focusedId) : undefined;
  const providerId = (term?.providerId ?? session?.providerId ?? 'claude') as ProviderId;
  const cliSessionId = session?.cliSessionId ?? null;
  return { providerId, cliSessionId };
}

/**
 * Open Warp at the current directory. If this tab has a resumable CLI session id, copy the provider’s
 * resume command to the clipboard so you can paste it in Warp (there is no `warp://…session=…` API).
 */
export async function openCurrentProjectInWarp(mode: 'tab' | 'window' = 'tab'): Promise<void> {
  const cwd = resolveDirectoryForWarp();
  if (!cwd) return;

  const { providerId, cliSessionId } = resolveSessionForWarp();
  const caps = getProviderCapabilities(providerId);
  const canResume = Boolean(cliSessionId) && caps?.sessionResume !== false;

  let copiedResume = false;
  if (canResume && cliSessionId) {
    const cmd = buildCliResumePasteCommand(providerId, cliSessionId);
    try {
      await navigator.clipboard.writeText(cmd);
      copiedResume = true;
    } catch (err) {
      console.error({ err, msg: 'clipboard write failed', cmd });
    }
  }

  try {
    await window.vibeyard.app.openInWarp(cwd, mode);
  } catch (err) {
    console.error({ err, cwd, mode });
    return;
  }

  if (copiedResume) {
    showAlertBanner({
      icon: '⎘',
      message:
        'Resume command copied to clipboard — switch to Warp, paste (Ctrl+Shift+V), then Enter.',
    });
  }
}
