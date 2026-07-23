import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ProjectRecord } from '../../shared/types.js';

// project-switcher.ts reads appState.projects and subscribes to unread changes.
// Mock both so filterProjects can be exercised as pure logic in the node env.
const mockProjects: ProjectRecord[] = [];
vi.mock('../state.js', () => ({
  appState: {
    get projects() {
      return mockProjects;
    },
  },
}));
vi.mock('../session-unread.js', () => ({
  hasUnreadInProject: () => false,
  onChange: () => () => {},
}));

import { filterProjects } from './project-switcher.js';

function project(name: string, path: string): ProjectRecord {
  // Only the fields filterProjects touches need to be real.
  return { name, path } as ProjectRecord;
}

describe('filterProjects', () => {
  beforeEach(() => {
    mockProjects.length = 0;
    mockProjects.push(
      project('Vibeyard', '/Users/dev/code/vibeyard'),
      project('API Server', '/Users/dev/work/api-server'),
      project('docs-site', '/Users/dev/blog/DOCS'),
    );
  });

  it('returns all projects for an empty query', () => {
    expect(filterProjects('')).toHaveLength(3);
  });

  it('matches on project name, case-insensitively', () => {
    const result = filterProjects('vibe');
    expect(result.map((p) => p.name)).toEqual(['Vibeyard']);
  });

  it('matches on project path, case-insensitively', () => {
    // "DOCS" is upper-case in the path; a lower-case query must still match.
    const result = filterProjects('docs');
    expect(result.map((p) => p.name)).toEqual(['docs-site']);
  });

  it('matches a substring that spans multiple projects', () => {
    const result = filterProjects('/users/dev');
    expect(result).toHaveLength(3);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterProjects('nonexistent-xyz')).toEqual([]);
  });
});
