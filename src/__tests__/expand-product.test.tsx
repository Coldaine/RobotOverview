import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { HangarProvider, useHangar, useCalculatedConstraints, LOCAL_INSIGHT_PREFIX } from '@/lib/store';
import { hangarData } from '@/data/hangar';

function wrapper({ children }: { children: React.ReactNode }) {
  return <HangarProvider>{children}</HangarProvider>;
}

beforeEach(() => {
  localStorage.clear();
});

// ─── D1: editable mission objectives ─────────────────────────────────────────

describe('toggleObjective() / missionObjectives()', () => {
  const missionId = 'perimeter-mapping';

  it('starts from the spine values (nothing overridden)', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const spine = hangarData.missions.find((m) => m.id === missionId)!;
    const objectives = result.current.missionObjectives(missionId);
    expect(objectives.map((o) => o.done)).toEqual(spine.objectives.map((o) => o.done));
  });

  it('toggling an objective flips only that objective', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const before = result.current.missionObjectives(missionId)[0].done;
    act(() => result.current.toggleObjective(missionId, 0));
    const after = result.current.missionObjectives(missionId);
    expect(after[0].done).toBe(!before);
    // siblings untouched
    expect(after[1]?.done).toBe(hangarData.missions.find((m) => m.id === missionId)!.objectives[1].done);
  });

  it('persists the objective toggle across a fresh provider mount', () => {
    const first = renderHook(() => useHangar(), { wrapper });
    act(() => first.result.current.toggleObjective(missionId, 0));
    const toggled = first.result.current.missionObjectives(missionId)[0].done;
    first.unmount();

    const second = renderHook(() => useHangar(), { wrapper });
    expect(second.result.current.missionObjectives(missionId)[0].done).toBe(toggled);
  });
});

// ─── D2: wishlist acquisition status ─────────────────────────────────────────

describe('setWishlistStatus()', () => {
  it('overrides the effective status returned by wish()', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const seeded = hangarData.wishlist.find((w) => w.id === 'depth-cam')!;
    expect(result.current.wish('depth-cam')?.status).toBe(seeded.status);
    act(() => result.current.setWishlistStatus('depth-cam', 'buy-next'));
    expect(result.current.wish('depth-cam')?.status).toBe('buy-next');
  });

  it('flows the new status into useCalculatedConstraints', () => {
    const { result } = renderHook(
      () => ({ h: useHangar(), c: useCalculatedConstraints('perimeter-mapping') }),
      { wrapper },
    );
    const depthCam = hangarData.wishlist.find((w) => w.id === 'depth-cam')!;
    const mission = hangarData.missions.find((m) => m.id === 'perimeter-mapping')!;
    const baseCost = mission.constraints.find((c) => c.unit === '$')!.value;

    // depth-cam starts 'researching' → excluded from the loadout cost
    expect(result.current.c.find((c) => c.unit === '$')?.value).toBe(baseCost);

    act(() => result.current.h.setWishlistStatus('depth-cam', 'buy-next'));

    expect(result.current.c.find((c) => c.unit === '$')?.value).toBe(baseCost + (depthCam.price.us ?? 0));
  });

  it('persists the status override across a fresh provider mount', () => {
    const first = renderHook(() => useHangar(), { wrapper });
    act(() => first.result.current.setWishlistStatus('depth-cam', 'on-order'));
    first.unmount();
    const second = renderHook(() => useHangar(), { wrapper });
    expect(second.result.current.wish('depth-cam')?.status).toBe('on-order');
  });
});

// ─── D4: content intake (local insights) ─────────────────────────────────────

describe('addLocalInsight() / removeLocalInsight()', () => {
  it('adds a locally-authored insight that resolves by id', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const countBefore = result.current.insights.length;
    act(() => result.current.addLocalInsight({ title: 'Cold-start dust', body: 'Backscatter blinds the cam.', tags: ['dust'] }));
    expect(result.current.insights.length).toBe(countBefore + 1);
    const added = result.current.insights.find((i) => i.title === 'Cold-start dust');
    expect(added).toBeDefined();
    expect(added!.id.startsWith(LOCAL_INSIGHT_PREFIX)).toBe(true);
    expect(result.current.insight(added!.id)?.body).toBe('Backscatter blinds the cam.');
  });

  it('ignores an empty draft (no title or body)', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    const countBefore = result.current.insights.length;
    act(() => result.current.addLocalInsight({ title: '   ', body: '' }));
    expect(result.current.insights.length).toBe(countBefore);
  });

  it('removes a local insight and persists the removal', () => {
    const first = renderHook(() => useHangar(), { wrapper });
    act(() => first.result.current.addLocalInsight({ title: 'Temp note', body: 'scratch' }));
    const id = first.result.current.insights.find((i) => i.title === 'Temp note')!.id;
    act(() => first.result.current.removeLocalInsight(id));
    expect(first.result.current.insight(id)).toBeUndefined();
    first.unmount();

    const second = renderHook(() => useHangar(), { wrapper });
    expect(second.result.current.insight(id)).toBeUndefined();
  });

  it('persists an added insight across a fresh provider mount', () => {
    const first = renderHook(() => useHangar(), { wrapper });
    act(() => first.result.current.addLocalInsight({ title: 'Persisted', body: 'survives reload' }));
    first.unmount();
    const second = renderHook(() => useHangar(), { wrapper });
    expect(second.result.current.insights.some((i) => i.title === 'Persisted')).toBe(true);
  });

  it('dedupes tags so a "dust, dust" entry yields one tag', () => {
    const { result } = renderHook(() => useHangar(), { wrapper });
    act(() => result.current.addLocalInsight({ title: 'Dust', body: 'b', tags: ['dust', 'dust', 'haze'] }));
    const added = result.current.insights.find((i) => i.title === 'Dust')!;
    expect(added.tags).toEqual(['dust', 'haze']);
  });
});

// ─── defensive localStorage parsing (review hardening) ───────────────────────

describe('corrupt-localStorage resilience', () => {
  it('ignores non-boolean nested objective overrides instead of crashing', () => {
    // a primitive nested value would make `index in overrides` throw
    localStorage.setItem('hangar:objectives', JSON.stringify({ 'perimeter-mapping': 5, undercroft: { 0: 'yes' } }));
    const { result } = renderHook(() => useHangar(), { wrapper });
    const spine = hangarData.missions.find((m) => m.id === 'perimeter-mapping')!;
    // falls back to spine values, no throw
    expect(result.current.missionObjectives('perimeter-mapping').map((o) => o.done)).toEqual(
      spine.objectives.map((o) => o.done),
    );
    // the non-boolean 'yes' is dropped, so undercroft objective 0 keeps its spine value
    const undercroftSpine = hangarData.missions.find((m) => m.id === 'undercroft')!;
    expect(result.current.missionObjectives('undercroft')[0].done).toBe(undercroftSpine.objectives[0].done);
  });

  it('normalizes a stored local insight with a non-array tags field (no crash)', () => {
    localStorage.setItem(
      'hangar:localInsights',
      JSON.stringify([{ id: 'local-bad', title: 'Bad', body: 'corrupt', tags: 'not-an-array' }]),
    );
    const { result } = renderHook(() => useHangar(), { wrapper });
    const recovered = result.current.insight('local-bad');
    expect(recovered).toBeDefined();
    expect(Array.isArray(recovered!.tags)).toBe(true);
    expect(recovered!.tags).toEqual([]);
    expect(recovered!.confidence).toBe('medium');
  });

  it('drops stale stored local insight bay ids instead of treating them as model ids', () => {
    localStorage.setItem(
      'hangar:localInsights',
      JSON.stringify([
        { id: 'local-stale-bay', title: 'Stale bay', body: 'corrupt', tags: [], bay: 'warehouse' },
        { id: 'local-valid-bay', title: 'Valid bay', body: 'ok', tags: [], bay: 'robotics' },
      ]),
    );

    const { result } = renderHook(() => useHangar(), { wrapper });

    expect(result.current.insight('local-stale-bay')?.bay).toBeUndefined();
    expect(result.current.insight('local-valid-bay')?.bay).toBe('robotics');
  });
});
