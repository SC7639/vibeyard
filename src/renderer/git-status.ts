import { appState } from './state.js';
import { onChange as onStatusChange } from './session-activity.js';
import type { GitWorktree } from './types.js';
import type { SessionRecord } from '../shared/types.js';

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  conflicted: number;
}

type GitStatusCallback = (projectId: string, status: GitStatus) => void;
type WorktreeChangeCallback = () => void;

const cache = new Map<string, GitStatus>();
const listeners: GitStatusCallback[] = [];
const worktreeChangeListeners: WorktreeChangeCallback[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
// Set when poll() is called while a poll is already in flight. The running
// poll loops once more so a request triggered mid-flight (e.g. a project
// switch) is never silently dropped — it re-reads the now-active project.
let repollRequested = false;

// Worktree cache: projectId → GitWorktree[]
const worktreeCache = new Map<string, GitWorktree[]>();
// Session → worktree path detected from the shell cwd (used when the tab isn't pinned)
const sessionWorktreeMap = new Map<string, string>();

/** Terminal-style tabs (unset `type`) can pin a git worktree per tab. */
export function sessionSupportsGitWorktreePin(session: SessionRecord | undefined): boolean {
  return session != null && !session.type;
}

/** Compare worktree roots across Windows/Linux and trailing slash differences. */
function normWorktreePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}
let worktreePollCounter = 0;
let unwatchGitChanged: (() => void) | null = null;

async function refreshWorktrees(projectId: string, projectPath: string): Promise<void> {
  try {
    const worktrees = await window.vibeyard.git.getWorktrees(projectPath) as GitWorktree[];
    const prev = worktreeCache.get(projectId);
    worktreeCache.set(projectId, worktrees);

    // Drop tab pins to worktrees that no longer exist. An empty list usually
    // means git failed — don't prune then (it would wipe every pinned tab).
    if (worktrees.length > 0) {
      appState.pruneStaleSessionGitWorktrees(projectId, new Set(worktrees.map((w) => w.path)));
    }

    if (!prev || JSON.stringify(prev) !== JSON.stringify(worktrees)) {
      for (const cb of worktreeChangeListeners) cb();
    }
  } catch {
    // Ignore errors
  }
}

async function detectSessionWorktree(sessionId: string): Promise<void> {
  const project = appState.activeProject;
  if (!project) return;
  const session = project.sessions.find((s) => s.id === sessionId);
  // Only terminal tabs follow a worktree, and a user pin always wins over the shell cwd.
  if (!session || !sessionSupportsGitWorktreePin(session) || session.gitWorktreeUserPinned) return;

  try {
    const cwd = await window.vibeyard.pty.getCwd(sessionId);
    if (!cwd) return;

    const worktrees = worktreeCache.get(project.id);
    if (!worktrees || worktrees.length <= 1) return;

    // Find which worktree the cwd falls under (longest path match)
    const cwdN = normWorktreePath(cwd);
    let bestMatch = '';
    for (const wt of worktrees) {
      if (wt.isBare) continue;
      const wtN = normWorktreePath(wt.path);
      if ((cwdN === wtN || cwdN.startsWith(wtN + '/')) && wtN.length > normWorktreePath(bestMatch).length) {
        bestMatch = wt.path;
      }
    }

    if (bestMatch) {
      const prev = sessionWorktreeMap.get(sessionId);
      sessionWorktreeMap.set(sessionId, bestMatch);
      // Persist so the tab respawns (and resumes) in the same checkout.
      appState.syncSessionGitWorktreeFromDetect(project.id, sessionId, bestMatch);
      if (prev !== bestMatch) {
        for (const cb of worktreeChangeListeners) cb();
      }
    } else if (sessionWorktreeMap.has(sessionId)) {
      // Shell left every worktree: stop reporting the stale one so "Auto" falls
      // back to the project root instead of lagging behind the shell.
      sessionWorktreeMap.delete(sessionId);
      appState.syncSessionGitWorktreeFromDetect(project.id, sessionId, null);
      for (const cb of worktreeChangeListeners) cb();
    }
  } catch {
    // Ignore errors
  }
}

async function poll(): Promise<void> {
  if (!appState.activeProject) return;
  // A poll is already running. Flag a re-poll so it picks up the latest active
  // project when it finishes, instead of dropping this request on the floor.
  if (polling) {
    repollRequested = true;
    return;
  }

  polling = true;
  try {
    do {
      repollRequested = false;

      // Re-read each iteration: the active project may have changed while the
      // previous iteration was awaiting (that's why we looped).
      const project = appState.activeProject;
      if (!project) break;

      // Refresh worktree list every 3rd poll (~30s)
      worktreePollCounter++;
      if (worktreePollCounter % 3 === 1) {
        await refreshWorktrees(project.id, project.path);
      }

      // Detect active session's worktree
      const activeSession = appState.activeSession;
      if (activeSession && activeSession.type !== 'diff-viewer' && activeSession.type !== 'file-reader' && activeSession.type !== 'mcp-inspector') {
        await detectSessionWorktree(activeSession.id);
      }

      // Query git status using the resolved worktree path
      const gitPath = getActiveGitPath(project.id);
      const status = await window.vibeyard.git.getStatus(gitPath) as GitStatus;
      const cacheKey = `${project.id}:${gitPath}`;
      const prev = cache.get(cacheKey);
      cache.set(cacheKey, status);
      // Also set by projectId for backward compatibility
      cache.set(project.id, status);

      if (!prev || JSON.stringify(prev) !== JSON.stringify(status)) {
        for (const cb of listeners) cb(project.id, status);
      }
    } while (repollRequested);
  } catch {
    // Ignore errors
  } finally {
    polling = false;
  }
}

export function getGitStatus(projectId: string): GitStatus | null {
  return cache.get(projectId) ?? null;
}

/** Total uncommitted changes for a project, or null when it's not a git repo. */
export function gitChangeCount(projectId: string): number | null {
  const status = getGitStatus(projectId);
  if (!status || !status.isGitRepo) return null;
  return status.staged + status.modified + status.untracked + status.conflicted;
}

export function getWorktrees(projectId: string): GitWorktree[] | null {
  return worktreeCache.get(projectId) ?? null;
}

export function getActiveGitPath(projectId: string): string {
  const project = appState.projects.find(p => p.id === projectId);
  if (!project?.activeSessionId) return project?.path ?? '';

  // The active tab's pinned/persisted worktree wins. Once the worktree list is
  // loaded, a path that no longer matches a real worktree is ignored.
  const session = project.sessions.find((s) => s.id === project.activeSessionId);
  const worktrees = worktreeCache.get(project.id);
  const persisted = session?.gitWorktreePath;
  if (
    persisted &&
    (!worktrees || worktrees.length === 0 || worktrees.some((w) => !w.isBare && w.path === persisted))
  ) {
    return persisted;
  }

  // Then the worktree detected from the tab's shell cwd
  const sessionWt = sessionWorktreeMap.get(project.activeSessionId);
  if (sessionWt) return sessionWt;

  // Fallback to project path
  return project.path;
}

export function getSessionWorktree(sessionId: string): string | null {
  const session = appState.activeProject?.sessions.find((s) => s.id === sessionId);
  return session?.gitWorktreePath ?? sessionWorktreeMap.get(sessionId) ?? null;
}

/**
 * Pin the active terminal tab to a worktree (selector choice); '' / null un-pins
 * it so the tab follows its shell cwd again. The pin is per tab, so switching
 * tabs switches the checkout git status reads.
 */
export function setActiveWorktree(projectId: string, path: string | null): void {
  const project = appState.projects.find((p) => p.id === projectId);
  if (!project?.activeSessionId) return;
  const pin = path != null && path !== '';
  appState.setSessionGitWorktree(projectId, project.activeSessionId, pin ? path : null, { userPinned: pin });
  poll();
  for (const cb of worktreeChangeListeners) cb();
}

export { poll as refreshGitStatus };

/**
 * Poll now AND re-list worktrees. A normal poll only re-lists them every third
 * run, so after creating a worktree/branch the selector (and the "known
 * worktree" check in getActiveGitPath) would otherwise lag by up to two polls.
 */
export function refreshWorktreesNow(): Promise<void> {
  worktreePollCounter = 0;
  return poll();
}

export function onChange(callback: GitStatusCallback): void {
  listeners.push(callback);
}

export function onWorktreeChange(callback: WorktreeChangeCallback): void {
  worktreeChangeListeners.push(callback);
}

function startInterval(): void {
  if (pollTimer) return; // Already polling
  if (document.hidden || !appState.activeProject) return; // No reason to poll
  poll();
  pollTimer = setInterval(poll, 60_000);
}

function stopInterval(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function startPolling(): void {
  startInterval();

  // Subscribe to main-process file system watcher push events (once)
  if (!unwatchGitChanged) {
    unwatchGitChanged = window.vibeyard.git.onChanged(() => poll());
  }

  // Start watcher for current project
  if (appState.activeProject) {
    window.vibeyard.git.watchProject(appState.activeProject.path);
  }

  // Pause/resume when window visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopInterval();
    } else {
      startInterval();
    }
  });

  // Watch + poll the active project, or stop when there is none. Fired on
  // project switch and on initial load — 'state-loaded' matters because a bare
  // project (active project, no session) emits only that event, so without it
  // the git panel would stay hidden until a session starts.
  const onActiveProjectChanged = () => {
    worktreePollCounter = 0; // Force worktree refresh on project switch
    if (!appState.activeProject) {
      stopInterval();
      return;
    }
    window.vibeyard.git.watchProject(appState.activeProject.path);
    startInterval(); // ensure the periodic timer is running
    poll(); // immediate refresh — startInterval() no-ops when a timer already exists
  };
  appState.on('state-loaded', onActiveProjectChanged);
  appState.on('project-changed', onActiveProjectChanged);
  appState.on('session-added', () => poll());

  // Detect worktree on session change
  appState.on('session-changed', () => {
    const activeSession = appState.activeSession;
    if (activeSession && activeSession.type !== 'diff-viewer' && activeSession.type !== 'file-reader' && activeSession.type !== 'mcp-inspector') {
      detectSessionWorktree(activeSession.id);
    }
    poll();
  });

  // Poll when a session transitions from working → waiting/completed
  onStatusChange((_sessionId, status) => {
    if (status === 'waiting' || status === 'completed') {
      // Also re-detect worktree on status transition
      detectSessionWorktree(_sessionId);
      poll();
    }
  });
}

export function stopPolling(): void {
  stopInterval();
}

// Test-only: clear all module-level state so each test starts from a clean
// slate (the production module is a long-lived singleton).
export function _resetForTesting(): void {
  stopInterval();
  polling = false;
  repollRequested = false;
  worktreePollCounter = 0;
  unwatchGitChanged = null;
  cache.clear();
  worktreeCache.clear();
  sessionWorktreeMap.clear();
  listeners.length = 0;
  worktreeChangeListeners.length = 0;
}
