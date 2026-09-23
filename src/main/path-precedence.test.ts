import * as path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./platform', () => ({
  isWin: false,
  pathSep: ':',
}));

vi.mock('os', () => ({
  homedir: vi.fn(() => '/home/tester'),
}));

import { mergePreferredBinDirsFirst } from './path-precedence';

describe('mergePreferredBinDirsFirst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prepends user-local dirs before system paths', () => {
    const localBin = path.join('/home/tester', '.local', 'bin');
    const npmGlobalBin = path.join('/home/tester', '.npm-global', 'bin');
    const out = mergePreferredBinDirsFirst('/usr/local/bin:/usr/bin:/bin');
    expect(out.split(':')[0]).toBe(localBin);
    expect(out.split(':')[1]).toBe(npmGlobalBin);
    expect(out).toContain('/opt/homebrew/bin');
    expect(out).toContain('/usr/local/bin');
    expect(out.indexOf(localBin)).toBeLessThan(out.indexOf('/usr/local/bin'));
  });

  it('dedupes repeated segments', () => {
    const localBin = path.join('/home/tester', '.local', 'bin');
    const out = mergePreferredBinDirsFirst(`/usr/local/bin:${localBin}:/usr/local/bin`);
    const parts = out.split(':');
    expect(parts.filter((p) => p === '/usr/local/bin').length).toBe(1);
  });
});
