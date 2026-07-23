import { describe, it, expect } from 'vitest';
import { isNavActive } from '@/lib/nav';

describe('isNavActive()', () => {
  it('hub ("/", end=true) is active only on exact "/"', () => {
    expect(isNavActive('/', '/', { end: true })).toBe(true);
    expect(isNavActive('/missions', '/', { end: true })).toBe(false);
    expect(isNavActive('/items', '/', { end: true })).toBe(false);
  });

  it('matches a path segment under the href', () => {
    expect(isNavActive('/unit/beast', '/unit', {})).toBe(true);
    expect(isNavActive('/items', '/items', {})).toBe(true);
    expect(isNavActive('/items/anything', '/items', {})).toBe(true);
  });

  it('does not match an unrelated route', () => {
    expect(isNavActive('/quartermaster', '/items', {})).toBe(false);
    expect(isNavActive('/datacore', '/items', {})).toBe(false);
  });

  it('Missions stays active on a mission detail via activePrefixes', () => {
    expect(isNavActive('/mission/undercroft', '/missions', { activePrefixes: ['/mission'] })).toBe(true);
    expect(isNavActive('/missions', '/missions', { activePrefixes: ['/mission'] })).toBe(true);
  });

  it('does not let a prefix bleed into a similarly-named sibling route', () => {
    // /items must NOT be considered active when the prefix is /item (no such route, guards substring bugs)
    expect(isNavActive('/items', '/item', {})).toBe(false);
    // /missions is its own route, not a child of /mission
    expect(isNavActive('/missions', '/mission', {})).toBe(false);
  });
});
