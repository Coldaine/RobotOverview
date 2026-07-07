import { describe, expect, it } from 'vitest';
import {
  HANGAR_FALLBACK_REASON_META,
  HANGAR_FALLBACK_REASONS,
  HANGAR_READ_SOURCE_META,
  HANGAR_READ_SOURCES,
  hangarFallbackDetail,
  hangarReadStatusLabel,
} from '@/lib/hangar-read-status';

describe('hangar read status presentation', () => {
  it('has display metadata for every read source', () => {
    expect(Object.keys(HANGAR_READ_SOURCE_META).sort()).toEqual([...HANGAR_READ_SOURCES].sort());
    expect(HANGAR_READ_SOURCE_META.postgres).toEqual({
      label: 'PG',
      dotClass: 'bg-signal-ok',
    });
    expect(HANGAR_READ_SOURCE_META.static).toEqual({
      label: 'STATIC',
      dotClass: 'bg-amber',
    });
  });

  it('has display metadata for every fallback reason', () => {
    expect(Object.keys(HANGAR_FALLBACK_REASON_META).sort()).toEqual(
      [...HANGAR_FALLBACK_REASONS].sort(),
    );
    expect(HANGAR_FALLBACK_REASON_META['not-configured']).toEqual({
      label: 'NOT CFG',
      detail: 'Postgres is not configured — every read is coming from the hangar.ts spine.',
    });
    expect(HANGAR_FALLBACK_REASON_META['postgres-error']).toEqual({
      label: 'PG ERR',
      detail: 'Postgres read FAILED — serving the hangar.ts spine with this visible warning.',
    });
  });

  it('formats compact read labels for the shell status line', () => {
    expect(hangarReadStatusLabel({ source: 'postgres' })).toBe('PG');
    expect(hangarReadStatusLabel({ source: 'postgres', fallbackReason: 'postgres-error' })).toBe(
      'PG',
    );
    expect(hangarReadStatusLabel({ source: 'static' })).toBe('STATIC');
    expect(hangarReadStatusLabel({ source: 'static', fallbackReason: 'not-configured' })).toBe(
      'STATIC · NOT CFG',
    );
    expect(hangarReadStatusLabel({ source: 'static', fallbackReason: 'postgres-error' })).toBe(
      'STATIC · PG ERR',
    );
  });

  it('returns banner detail for fallback and unknown-static cases', () => {
    expect(hangarFallbackDetail('not-configured')).toBe(
      'Postgres is not configured — every read is coming from the hangar.ts spine.',
    );
    expect(hangarFallbackDetail('postgres-error')).toBe(
      'Postgres read FAILED — serving the hangar.ts spine with this visible warning.',
    );
    expect(hangarFallbackDetail()).toBe('Serving the static hangar.ts spine.');
  });
});
