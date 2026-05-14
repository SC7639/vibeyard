import { appState } from '../state.js';
import type { ProjectRecord } from '../../shared/types.js';

let overlay: HTMLElement | null = null;
let input: HTMLInputElement | null = null;
let resultsList: HTMLElement | null = null;
let activeIndex = 0;
let results: ProjectRecord[] = [];

function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
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

function filterProjects(query: string): ProjectRecord[] {
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
    if (project.id === activeId) item.classList.add('current');

    const marker = project.id === activeId ? '<span class="quick-open-current-marker">●</span>' : '';
    item.innerHTML =
      `${marker}<span class="quick-open-filename">${escapeHtml(project.name)}</span>` +
      `<span class="quick-open-dir">${escapeHtml(project.path)}</span>`;

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
}

function hideProjectSwitcher(): void {
  if (overlay) overlay.style.display = 'none';
}
