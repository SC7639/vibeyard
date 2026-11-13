import { describe, it, expect } from 'vitest';
import { NavHistory } from './nav-history';

describe('NavHistory.lastDistinct()', () => {
  it('returns the entry before the current one without moving the cursor', () => {
    const nav = new NavHistory();
    nav.push('a');
    nav.push('b');
    nav.push('c');
    expect(nav.lastDistinct('c', () => true)).toBe('b');
    // Cursor untouched: a back step still lands on 'b', not 'a'.
    expect(nav.findNextValid(-1, () => true)).toBe('b');
  });

  it('skips entries equal to the current id and invalid ones', () => {
    const nav = new NavHistory();
    nav.push('a');
    nav.push('b');
    nav.push('c');
    nav.push('b');
    expect(nav.lastDistinct('b', (id) => id !== 'c')).toBe('a');
  });

  it('returns null when nothing but the current tab was ever active', () => {
    const nav = new NavHistory();
    expect(nav.lastDistinct(undefined, () => true)).toBeNull();
    nav.push('a');
    expect(nav.lastDistinct('a', () => true)).toBeNull();
  });

  it('reads from the cursor, not the end, after stepping back', () => {
    const nav = new NavHistory();
    nav.push('a');
    nav.push('b');
    nav.push('c');
    nav.findNextValid(-1, () => true); // now on 'b'
    expect(nav.lastDistinct('b', () => true)).toBe('a');
  });
});
