import { describe, expect, it } from 'vitest';
import { hangarData } from '@/data/hangar';
import { applyEntity, parseIngestBody } from '@/server/hangar/ingest';

describe('hangar ingest', () => {
  it('parses a valid ingest body', () => {
    const body = parseIngestBody({
      entity: 'insight',
      record: {
        id: 'insight-test',
        title: 'Test',
        body: 'Body',
        tags: [],
        confidence: 'medium',
        capturedAt: '2026-07-30',
      },
    });
    expect(body.entity).toBe('insight');
    expect(body.record.id).toBe('insight-test');
  });

  it('rejects unknown entity kinds', () => {
    expect(() =>
      parseIngestBody({ entity: 'spaceship', record: { id: 'x' } }),
    ).toThrow();
  });

  it('upserts an insight into a HangarData clone', () => {
    const next = applyEntity(hangarData, 'insight', {
      id: 'insight-ingest-test',
      title: 'Ingested',
      body: 'From API',
      tags: ['test'],
      confidence: 'high',
      capturedAt: '2026-07-30',
    });
    expect(next.insights.some((i) => i.id === 'insight-ingest-test')).toBe(true);
  });
});
