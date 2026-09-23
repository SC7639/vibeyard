import { appState } from '../state.js';
import { hasUnreadInProject, onChange as onUnreadChange } from '../session-unread.js';
import { onChange as onActivityChange, type SessionStatus } from '../session-activity.js';
import { getProjectStatus } from '../project-status.js';
import { esc } from '../dom-utils.js';
import type { ProjectRecord } from '../../shared/types.js';

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let resultsList: HTMLElement | null = null;
let activeIndex = 0;
let results: ProjectRecord[] = [];
let unsubscribeUnread: (() => void) | null = null;
let unsubscribeActivity: (() => void) | null = null;

/**
 * Lead marker for a row. The current project keeps its accent dot; any other
 * project shows the same status-coloured dot as the sidebar (waiting, input,
 * working, completed), so "needs attention" reads the same in both places.
 * Unread with no live status falls back to the completed colour.
 */
export function projectMarker(status: SessionStatus, isCurrent: boolean, unread: boolean): string {
  if (isCurrent) return '<span class="quick-open-current-marker">●</span>';
  const shown = status !== 'idle' ? status : unread ? 'completed' : null;
  if (!shown) return '';
  return `<span class="project-status ${shown}" title="${shown}" aria-hidden="true"></span>`;
}

function createOverlay(): void {
  if (overlay) return;

  overlay = document.createElement('div');
  overlay.className = 'quick-open-overlay';
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) hideProjectSwitcher();
  });

  const container = document.createElement('div');
  container.className = 'quick-open-container';

  input = document.createElement('input');
  input.className = 'quick-open-input';
  input.type = 'text';
  input.placeholder = 'Switch project...';
  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', onKeydown);

  resultsList = document.createElement('div');
  resultsList.className = 'quick-open-results';

  container.appendChild(input);
  container.appendChild(resultsList);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

export function filterProjects(query: string): ProjectRecord[] {
  const projects = appState.projects;
  if (!query) return projects;

  const q = query.toLowerCase();
  return projects.filter(
    (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
  );
}

function renderResults(): void {
  if (!resultsList || !input) return;
  results = filterProjects(input.value);
  activeIndex = Math.min(activeIndex, Math.max(0, results.length - 1));
  resultsList.innerHTML = '';

  if (results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'quick-open-empty';
    empty.textContent = appState.projects.length === 0
      ? 'No projects — add one first'
      : 'No projects match';
    resultsList.appendChild(empty);
    return;
  }

  const activeId = appState.activeProjectId;

  for (let i = 0; i < results.length; i++) {
    const project = results[i];
    const item = document.createElement('div');
    item.className = 'quick-open-item';
    if (i === activeIndex) item.classList.add('active');
    const isCurrent = project.id === activeId;
    const unread = hasUnreadInProject(project.id);
    if (isCurrent) item.classList.add('current');
    if (unread) item.classList.add('unread');

    const marker = projectMarker(getProjectStatus(project), isCurrent, unread);
    item.innerHTML =
      `${marker}<span class="quick-open-filename">${esc(project.name)}</span>` +
      `<span class="quick-open-dir">${esc(project.path)}</span>`;

    item.addEventListener('mouseenter', () => {
      activeIndex = i;
      updateActiveItem();
    });
    item.addEventListener('click', () => {
      activeIndex = i;
      selectProject();
    });

    resultsList.appendChild(item);
  }
}

function updateActiveItem(): void {
  if (!resultsList) return;
  const items = resultsList.querySelectorAll('.quick-open-item');
  items.forEach((el, i) => el.classList.toggle('active', i === activeIndex));
  const active = items[activeIndex] as HTMLElement | undefined;
  active?.scrollIntoView({ block: 'nearest' });
}

function onKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (results.length > 0) {
        activeIndex = (activeIndex + 1) % results.length;
        updateActiveItem();
      }
      break;
    case 'ArrowUp':
      e.preventDefault();
      if (results.length > 0) {
        activeIndex = (activeIndex - 1 + results.length) % results.length;
        updateActiveItem();
      }
      break;
    case 'Enter':
      e.preventDefault();
      selectProject();
      break;
    case 'Escape':
      e.preventDefault();
      hideProjectSwitcher();
      break;
  }
}

function selectProject(): void {
  if (activeIndex < 0 || activeIndex >= results.length) return;
  const project = results[activeIndex];
  if (project.id !== appState.activeProjectId) {
    appState.setActiveProject(project.id);
  }
  hideProjectSwitcher();
}

export function showProjectSwitcher(): void {
  createOverlay();
  if (!overlay || !input) return;

  overlay.style.display = 'flex';
  input.value = '';
  activeIndex = 0;

  const activeId = appState.activeProjectId;
  if (activeId) {
    const idx = appState.projects.findIndex((p) => p.id === activeId);
    if (idx >= 0) activeIndex = idx;
  }

  renderResults();
  input.focus();

  const rerenderWhileOpen = () => {
    if (overlay && overlay.style.display !== 'none') renderResults();
  };
  if (!unsubscribeUnread) unsubscribeUnread = onUnreadChange(rerenderWhileOpen);
  if (!unsubscribeActivity) unsubscribeActivity = onActivityChange(rerenderWhileOpen);
}

function hideProjectSwitcher(): void {
  if (overlay) overlay.style.display = 'none';
  if (unsubscribeUnread) {
    unsubscribeUnread();
    unsubscribeUnread = null;
  }
  if (unsubscribeActivity) {
    unsubscribeActivity();
    unsubscribeActivity = null;
  }
}
