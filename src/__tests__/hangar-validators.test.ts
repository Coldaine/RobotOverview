import { describe, expect, it } from 'vitest';
import {
  isTrimmedHttpUrl,
  isTrimmedNonBlankString,
  isTrimmedTimestamp,
  postgresNonBlankTextArray,
} from '@/server/hangar/validators';

describe('Hangar shared DB validators', () => {
  it('accepts only trimmed nonblank display strings', () => {
    expect(isTrimmedNonBlankString('Robot Ops')).toBe(true);
    expect(isTrimmedNonBlankString(' Robot Ops')).toBe(false);
    expect(isTrimmedNonBlankString('')).toBe(false);
    expect(isTrimmedNonBlankString(' ')).toBe(false);
  });

  it('accepts only trimmed HTTP(S) URLs', () => {
    expect(isTrimmedHttpUrl('https://example.com/source')).toBe(true);
    expect(isTrimmedHttpUrl('http://example.com/source')).toBe(true);
    expect(isTrimmedHttpUrl('ftp://example.com/source')).toBe(false);
    expect(isTrimmedHttpUrl(' https://example.com/source')).toBe(false);
  });

  it('accepts only trimmed parseable timestamps', () => {
    expect(isTrimmedTimestamp('2026-07-07')).toBe(true);
    expect(isTrimmedTimestamp('2026-07-07T22:00:00Z')).toBe(true);
    expect(isTrimmedTimestamp('42')).toBe(false);
    expect(isTrimmedTimestamp('2026')).toBe(false);
    expect(isTrimmedTimestamp('2026-02-31')).toBe(false);
    expect(isTrimmedTimestamp('not-a-date')).toBe(false);
    expect(isTrimmedTimestamp(' 2026-07-07')).toBe(false);
  });

  it('rejects malformed Postgres text arrays with blank display values', () => {
    expect(postgresNonBlankTextArray(['Ready', 'Verified'], 'test rows')).toEqual([
      'Ready',
      'Verified',
    ]);
    expect(() => postgresNonBlankTextArray(['Ready', ' '], 'test rows')).toThrow(
      'Invalid test rows from hangar DB: expected non-blank trimmed text at index 1.',
    );
  });
});
