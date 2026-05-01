import { appState } from './state.js';
import { refreshGitStatus, getActiveGitPath } from './git-status.js';
import { showModal, closeModal, setModalError } from './components/modal.js';

export function applyWorktreeSelection(projectId: string, path: string | null): void {
  const project = appState.projects.find((p) => p.id === projectId);
  if (!project?.activeSessionId) return;
  const pin = path != null && path !== '';
  appState.setSessionGitWorktree(projectId, project.activeSessionId, path, { userPinned: pin });
  void refreshGitStatus();
}

export function promptCreateBranch(gitPath: string): void {
  showModal('Create New Branch', [
    { label: 'Branch name', id: 'branch-name', placeholder: 'feature/my-branch' },
  ], async (values) => {
    const name = values['branch-name']?.trim();
    if (!name) {
      setModalError('branch-name', 'Branch name is required');
      return;
    }
    if (/\s/.test(name)) {
      setModalError('branch-name', 'Branch name cannot contain spaces');
      return;
    }
    try {
      await window.vibeyard.git.createBranch(gitPath, name);
      closeModal();
      await refreshGitStatus();
    } catch (err) {
      setModalError('branch-name', err instanceof Error ? err.message : 'Failed to create branch');
    }
  });
}

export function promptCreateWorktree(project: { id: string; path: string }): void {
  const activePath = getActiveGitPath(project.id);
  showModal(
    'Create New Worktree',
    [
      {
        label: 'Worktree path',
        id: 'wt-path',
        placeholder: 'Folder name or absolute path; leave empty to create a branch in the current checkout',
      },
      {
        label: 'New branch (optional)',
        id: 'wt-branch',
        placeholder: 'With empty path: branch name only; with path: new branch for that worktree',
      },
    ],
    async (values) => {
      const wtPath = values['wt-path']?.trim() ?? '';
      const branch = values['wt-branch']?.trim();
      if (branch && /\s/.test(branch)) {
        setModalError('wt-branch', 'Branch name cannot contain spaces');
        return;
      }

      if (!wtPath) {
        if (branch) {
          try {
            await window.vibeyard.git.createBranch(activePath, branch);
            closeModal();
            await refreshGitStatus();
          } catch (err) {
            setModalError('wt-branch', err instanceof Error ? err.message : 'Failed to create branch');
          }
          return;
        }
        setModalError(
          'wt-path',
          'Enter a worktree path, or enter a branch name only (leave path empty) to create a branch in the current checkout',
        );
        return;
      }

      try {
        await window.vibeyard.git.createWorktree(project.path, wtPath, branch || undefined);
        closeModal();
        await refreshGitStatus();
      } catch (err) {
        setModalError('wt-path', err instanceof Error ? err.message : 'Failed to create worktree');
      }
    },
  );
}
